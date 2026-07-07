import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { chargeTokenizedCard } from '../integrations/nomba/nomba.client';
import { classifyFailure, isPermanentFailure } from './failure.classifier';
import { transitionSubscriptionStatus } from '../modules/subscription/subscription.state-machine';
import { calculatePeriodEnd } from '../lib/billing.utils';
import { getDunningQueue } from '../queues/queue.registry';
import { JOB_NAMES } from '../queues/queue.definitions';
import { env } from '../config/env';
import { logger } from '../lib/logger';

// ─── Constants ────────────────────────────────────────

/** Delay windows (in hours) between successive dunning retries. */
const DUNNING_RETRY_DELAYS_HOURS = [1, 24, 72];

// ─── Public Types ─────────────────────────────────────

export type ChargeType = 'RENEWAL' | 'PRORATION' | 'RETRY';

export interface ExecuteChargeOptions {
  subscriptionId: string;
  merchantId: string;
  amountKobo: number;
  chargeType: ChargeType;
  retryAttempt?: number;
  description?: string;
}

export interface ChargeOutcome {
  success: boolean;
  transactionId: string;
  failureReason?: string;
}

// ─── Charge Execution ─────────────────────────────────

/**
 * Orchestrates the full charge lifecycle: validates subscription state, enforces
 * idempotency, calls the Nomba gateway, then routes to success or failure handling.
 */
export async function executeCharge(options: ExecuteChargeOptions): Promise<ChargeOutcome> {
  const {
    subscriptionId,
    merchantId,
    amountKobo,
    chargeType,
    retryAttempt = 0,
    description,
  } = options;

  // ── Load subscription with related plan + customer ──
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, merchantId, isDeleted: false },
    select: {
      id: true,
      status: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      retryCount: true,
      plan: {
        select: { name: true, interval: true, intervalDays: true },
      },
      customer: {
        select: {
          id: true,
          email: true,
          nombaTokenKey: true,
        },
      },
    },
  });

  if (!subscription) {
    throw new Error(`Subscription ${subscriptionId} not found — skipping charge`);
  }

  // ── Guard: only chargeable statuses ──
  const chargeableStatuses = ['ACTIVE', 'TRIALING', 'PAST_DUE'];
  if (!chargeableStatuses.includes(subscription.status)) {
    logger.warn('Charge skipped — subscription not in chargeable state', {
      subscriptionId,
      status: subscription.status,
      chargeType,
    });
    throw new Error(
      `Subscription ${subscriptionId} is in ${subscription.status} state — cannot charge`,
    );
  }

  // ── Guard: payment method must exist ──
  if (!subscription.customer.nombaTokenKey) {
    logger.error('Charge skipped — no payment method on file', { subscriptionId });
    await transitionSubscriptionStatus({
      subscriptionId,
      toStatus: 'PAST_DUE',
      eventType: 'RENEWAL_PAYMENT_FAILED',
      metadata: { reason: 'No payment method on file', chargeType },
    });
    throw new Error('No nombaTokenKey on customer — cannot charge');
  }

  // ── Idempotency: derive a deterministic key per (sub, period, type, attempt) ──
  const idempotencyKey = generateIdempotencyKey(
    subscriptionId,
    subscription.currentPeriodStart,
    chargeType,
    retryAttempt,
  );

  const existingTransaction = await prisma.transaction.findUnique({
    where: { idempotencyKey },
    select: { id: true, status: true },
  });

  if (existingTransaction) {
    if (existingTransaction.status === 'SUCCESS') {
      logger.info('Charge skipped — idempotent: already succeeded for this period', {
        subscriptionId,
        idempotencyKey,
        existingTransactionId: existingTransaction.id,
      });
      return { success: true, transactionId: existingTransaction.id };
    }
    logger.warn('Charge skipped — idempotent: already attempted for this period', {
      subscriptionId,
      idempotencyKey,
      existingTransactionId: existingTransaction.id,
      existingStatus: existingTransaction.status,
    });
    return { success: false, transactionId: existingTransaction.id };
  }

  // ── Create PENDING transaction record ──
  const transaction = await prisma.transaction.create({
    data: {
      merchantId,
      subscriptionId,
      amountKobo,
      currency: 'NGN',
      status: 'PENDING' as any,
      idempotencyKey,
      chargeType,
      retryAttempt,
    },
    select: { id: true },
  });

  logger.info('Charge attempt started', {
    transactionId: transaction.id,
    subscriptionId,
    amountKobo,
    chargeType,
    retryAttempt,
    idempotencyKey,
  });

  // ── Build a human-readable description (internal use only) ──
  const chargeDescription =
    description ??
    `${chargeType === 'RENEWAL' ? 'Renewal' : chargeType === 'PRORATION' ? 'Plan upgrade adjustment' : 'Retry charge'} — ${subscription.plan.name}`;

  const callbackUrl = `${env.APP_BASE_URL}/api/v1/webhooks/nomba/callback`;

  // ── Execute the charge via Nomba ──
  const chargeResult = await chargeTokenizedCard(
    amountKobo,
    subscription.customer.nombaTokenKey,
    subscription.customer.email,
    subscription.customer.id,
    idempotencyKey,
    callbackUrl,
  );

  logger.debug('Charge description (internal only, not sent to Nomba)', {
    transactionId: transaction.id,
    chargeDescription,
  });

  // ── Route to success or failure handler ──
  if (chargeResult.success) {
    await handleSuccessfulCharge({
      transactionId: transaction.id,
      subscriptionId,
      merchantId,
      chargeResult,
      chargeType,
      planInterval: subscription.plan.interval,
      planIntervalDays: subscription.plan.intervalDays,
      previousStatus: subscription.status,
      chargeAmountKobo: amountKobo,
    });

    return { success: true, transactionId: transaction.id };
  } else {
    await handleFailedCharge({
      transactionId: transaction.id,
      subscriptionId,
      merchantId,
      chargeResult,
      chargeType,
      retryAttempt,
      previousStatus: subscription.status,
    });

    return {
      success: false,
      transactionId: transaction.id,
      failureReason: chargeResult.failureCode,
    };
  }
}

// ─── Success Handler ──────────────────────────────────

interface SuccessHandlerOptions {
  transactionId: string;
  subscriptionId: string;
  merchantId: string;
  chargeResult: Awaited<ReturnType<typeof chargeTokenizedCard>>;
  chargeType: ChargeType;
  planInterval: string;
  planIntervalDays: number | null;
  previousStatus: string;
  chargeAmountKobo?: number;
}

/**
 * On successful charge: marks the transaction SUCCESS, advances the billing
 * period for renewals/retries, resets the retry counter, and triggers status
 * transitions (e.g. TRIALING → ACTIVE, PAST_DUE → ACTIVE).
 */
async function handleSuccessfulCharge(opts: SuccessHandlerOptions): Promise<void> {
  const {
    transactionId,
    subscriptionId,
    chargeResult,
    chargeType,
    planInterval,
    planIntervalDays,
    previousStatus,
  } = opts;

  // Only advance the billing period for renewals and retries (not prorations)
  const shouldAdvancePeriod = chargeType === 'RENEWAL' || chargeType === 'RETRY';

  const nextPeriodStart = shouldAdvancePeriod ? new Date() : undefined;
  const nextPeriodEnd = shouldAdvancePeriod
    ? calculatePeriodEnd(nextPeriodStart!, planInterval as any, planIntervalDays)
    : undefined;

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'SUCCESS' as any,
        nombaReference: chargeResult.orderReference,
        gatewayResponse: chargeResult.rawResponse as unknown as Prisma.InputJsonValue,
      },
    }),

    prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        ...(shouldAdvancePeriod && {
          currentPeriodStart: nextPeriodStart,
          currentPeriodEnd: nextPeriodEnd,
        }),
        retryCount: 0,
        nextRetryAt: null,
        lastFailureReason: null,
      },
    }),
  ]);

  // ── State machine transitions based on previous status ──
  if (previousStatus === 'TRIALING') {
    await transitionSubscriptionStatus({
      subscriptionId,
      toStatus: 'ACTIVE',
      eventType: 'TRIAL_ENDED_ACTIVATED',
      metadata: { transactionId, chargeType },
    });
  } else if (previousStatus === 'PAST_DUE') {
    await transitionSubscriptionStatus({
      subscriptionId,
      toStatus: 'ACTIVE',
      eventType: 'PAYMENT_RECOVERED',
      metadata: { transactionId, chargeType },
    });

    // Fire-and-forget the payment-recovered notification email
    try {
      const sub = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        select: {
          currentPeriodEnd: true,
          customer: { select: { email: true, name: true, phone: true } },
          plan: { select: { name: true } },
        },
      });
      if (sub?.customer) {
        const { sendPaymentRecoveredEmail } = await import('../services/notification.service');
        await sendPaymentRecoveredEmail({
          customerEmail: sub.customer.email,
          customerName: sub.customer.name ?? undefined,
          planName: sub.plan.name,
          amountKobo: opts.chargeAmountKobo ?? 0,
          nextBillingDate: sub.currentPeriodEnd,
        });
      }
    } catch (emailErr) {
      logger.warn('Failed to send payment-recovered email', {
        subscriptionId,
        error: emailErr,
      });
    }
  } else {
    // Normal renewal — just log the event
    await prisma.subscriptionEvent.create({
      data: {
        subscriptionId,
        eventType: `${chargeType}_CHARGE_SUCCEEDED`,
        fromStatus: 'ACTIVE',
        toStatus: 'ACTIVE',
        metadata: {
          transactionId,
          chargeType,
        } as Prisma.InputJsonValue,
      },
    });
  }

  try {
    const { recalculatePulseScore } = await import('../lib/pulse.score');
    await recalculatePulseScore(subscriptionId);
  } catch (scoreErr) {
    logger.warn('Pulse score recalculation failed after success — non-critical', {
      subscriptionId, error: scoreErr,
    });
  }

  logger.info('Charge succeeded', {
    subscriptionId,
    transactionId,
    chargeType,
    ...(shouldAdvancePeriod && { nextPeriodEnd: nextPeriodEnd?.toISOString() }),
  });
}

// ─── Failure Handler ──────────────────────────────────

interface FailureHandlerOptions {
  transactionId: string;
  subscriptionId: string;
  merchantId: string;
  chargeResult: Awaited<ReturnType<typeof chargeTokenizedCard>>;
  chargeType: ChargeType;
  retryAttempt: number;
  previousStatus: string;
}

/**
 * On failed charge: classifies the failure, updates the transaction, transitions
 * to PAST_DUE, and either escalates immediately (permanent failure) or schedules
 * the next dunning retry.
 */
async function handleFailedCharge(opts: FailureHandlerOptions): Promise<void> {
  const {
    transactionId,
    subscriptionId,
    merchantId,
    chargeResult,
    chargeType,
    retryAttempt,
  } = opts;

  const failureReason = classifyFailure(
    chargeResult.failureCode,
    chargeResult.failureMessage,
  );

  const permanent = isPermanentFailure(failureReason);

  // ── Record the failure on the transaction ──
  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: 'FAILED' as any,
      gatewayResponse: chargeResult.rawResponse as unknown as Prisma.InputJsonValue,
      failureReason,
      failureMessage: chargeResult.failureMessage ?? null,
    },
  });

  // ── Move subscription to PAST_DUE ──
  await transitionSubscriptionStatus({
    subscriptionId,
    toStatus: 'PAST_DUE',
    eventType: chargeType === 'RENEWAL' ? 'RENEWAL_PAYMENT_FAILED' : 'RETRY_PAYMENT_FAILED',
    metadata: {
      transactionId,
      failureReason,
      failureMessage: chargeResult.failureMessage,
      chargeType,
      retryAttempt,
      isPermanent: permanent,
    },
  });

  // ── Permanent failure (expired/invalid card) → suspend immediately ──
  if (permanent) {
    logger.warn('Permanent card failure — escalating directly to SUSPENDED', {
      subscriptionId,
      failureReason,
    });

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        lastFailureReason: failureReason,
        retryCount: 99,
        nextRetryAt: null,
      },
    });

    await transitionSubscriptionStatus({
      subscriptionId,
      toStatus: 'SUSPENDED',
      eventType: 'DUNNING_EXHAUSTED',
      metadata: {
        reason: 'PERMANENT_CARD_FAILURE',
        failureReason,
        chargeType,
      },
    });

    // Notify the customer to update their card
    try {
      const sub = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        select: {
          customer: { select: { email: true, name: true, phone: true } },
          plan: { select: { name: true } },
        },
      });
      if (sub?.customer) {
        const { sendUpdateCardEmail } = await import('../services/notification.service');
        await sendUpdateCardEmail({
          customerEmail: sub.customer.email,
          customerName: sub.customer.name ?? undefined,
          planName: sub.plan.name,
          failureReason,
        });
      }
    } catch (emailErr) {
      logger.warn('Failed to send update-card email on permanent failure', {
        subscriptionId,
        error: emailErr,
      });
    }

    return;
  }

  // ── Transient failure — schedule the next retry if attempts remain ──
  const nextRetryAttempt = retryAttempt + 1;
  const maxRetries = DUNNING_RETRY_DELAYS_HOURS.length;

  if (nextRetryAttempt <= maxRetries) {
    const delayHours = DUNNING_RETRY_DELAYS_HOURS[retryAttempt] ?? 72;
    const delayMs = delayHours * 60 * 60 * 1000;
    const nextRetryAt = new Date(Date.now() + delayMs);

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        retryCount: nextRetryAttempt,
        nextRetryAt,
        lastFailureReason: failureReason,
      },
    });

    const dunningQueue = getDunningQueue();
    await dunningQueue.add(
      JOB_NAMES.PROCESS_DUNNING_RETRY,
      { subscriptionId, merchantId, retryAttempt: nextRetryAttempt },
      {
        delay: delayMs,
        attempts: 1,
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    );

    logger.info('Dunning retry scheduled', {
      subscriptionId,
      nextRetryAttempt,
      delayHours,
      nextRetryAt: nextRetryAt.toISOString(),
    });
  } else {
    // ── No retries left — suspend ──
    logger.warn('Max dunning retries exhausted — transitioning to SUSPENDED', {
      subscriptionId,
      retryAttempt,
      maxRetries,
    });

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        lastFailureReason: failureReason,
        nextRetryAt: null,
      },
    });

    await transitionSubscriptionStatus({
      subscriptionId,
      toStatus: 'SUSPENDED',
      eventType: 'DUNNING_EXHAUSTED',
      metadata: {
        reason: 'MAX_RETRIES_EXHAUSTED',
        totalAttempts: retryAttempt + 1,
        failureReason,
      },
    });

    // Notify the customer that their subscription is suspended
    try {
      const sub = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        select: {
          customer: { select: { email: true, name: true, phone: true } },
          plan: { select: { name: true } },
        },
      });
      if (sub?.customer) {
        const { sendSubscriptionSuspendedEmail } = await import('../services/notification.service');
        await sendSubscriptionSuspendedEmail({
          customerEmail: sub.customer.email,
          customerName: sub.customer.name ?? undefined,
          planName: sub.plan.name,
          totalAttempts: retryAttempt + 1,
        });
      }
    } catch (emailErr) {
      logger.warn('Failed to send suspension email after max retries', {
        subscriptionId,
        error: emailErr,
      });
    }
  }

  try {
    const { recalculatePulseScore } = await import('../lib/pulse.score');
    await recalculatePulseScore(subscriptionId);
  } catch (scoreErr) {
    logger.warn('Pulse score recalculation failed after failure — non-critical', {
      subscriptionId, error: scoreErr,
    });
  }
}

// ─── Helpers ──────────────────────────────────────────

/**
 * Generates a deterministic idempotency key from the subscription, billing
 * period, charge type, and retry attempt. Uses HMAC-SHA256 with the app's
 * API_KEY_SALT so the key cannot be forged.
 */
function generateIdempotencyKey(
  subscriptionId: string,
  periodStart: Date,
  chargeType: string,
  retryAttempt: number,
): string {
  const raw = `${subscriptionId}:${periodStart.toISOString()}:${chargeType}:${retryAttempt}`;
  return crypto
    .createHmac('sha256', env.API_KEY_SALT)
    .update(raw)
    .digest('hex');
}
