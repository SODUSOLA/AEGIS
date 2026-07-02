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

const DUNNING_RETRY_DELAYS_HOURS = [1, 24, 72];

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

export async function executeCharge(options: ExecuteChargeOptions): Promise<ChargeOutcome> {
  const {
    subscriptionId,
    merchantId,
    amountKobo,
    chargeType,
    retryAttempt = 0,
    description,
  } = options;

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

  const chargeDescription =
    description ??
    `${chargeType === 'RENEWAL' ? 'Renewal' : chargeType === 'PRORATION' ? 'Plan upgrade adjustment' : 'Retry charge'} — ${subscription.plan.name}`;

  const callbackUrl = `${env.APP_BASE_URL}/api/v1/webhooks/nomba/callback`;

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

interface SuccessHandlerOptions {
  transactionId: string;
  subscriptionId: string;
  merchantId: string;
  chargeResult: Awaited<ReturnType<typeof chargeTokenizedCard>>;
  chargeType: ChargeType;
  planInterval: string;
  planIntervalDays: number | null;
  previousStatus: string;
}

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
  } else {
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

  logger.info('Charge succeeded', {
    subscriptionId,
    transactionId,
    chargeType,
    ...(shouldAdvancePeriod && { nextPeriodEnd: nextPeriodEnd?.toISOString() }),
  });
}

interface FailureHandlerOptions {
  transactionId: string;
  subscriptionId: string;
  merchantId: string;
  chargeResult: Awaited<ReturnType<typeof chargeTokenizedCard>>;
  chargeType: ChargeType;
  retryAttempt: number;
  previousStatus: string;
}

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

  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: 'FAILED' as any,
      gatewayResponse: chargeResult.rawResponse as unknown as Prisma.InputJsonValue,
      failureReason,
      failureMessage: chargeResult.failureMessage ?? null,
    },
  });

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

  if (permanent) {
    logger.warn('Permanent card failure — skipping dunning, escalating to SUSPENDED', {
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

    return;
  }

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
    logger.warn('Max dunning retries reached', {
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
  }
}

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
