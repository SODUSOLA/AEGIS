import { prisma } from '../../../db/prisma';
import { logger } from '../../../lib/logger';
import { NombaWebhookPayload } from '../../../integrations/nomba/nomba.types';
import {
  extractTokenizedCardDataFromWebhook,
} from '../../../integrations/nomba/nomba.webhook';
import { transitionSubscriptionStatus } from '../../subscription/subscription.state-machine';
import { calculatePeriodEnd } from '../../../lib/billing.utils';

// ─── Event Router ────────────────────────────────────

/** Route an inbound Nomba webhook payload to the appropriate handler based on event_type. */
export async function processNombaWebhook(
  payload: NombaWebhookPayload,
): Promise<void> {
  const eventType = payload.event_type;

  logger.info('Processing Nomba webhook event', {
    eventType,
    requestId: payload.requestId,
  });

  switch (eventType) {
    case 'payment_success':
      await handlePaymentSuccess(payload);
      break;

    case 'payment_failed':
      await handlePaymentFailed(payload);
      break;

    default:
      logger.info('Nomba webhook event received — no action required', {
        eventType,
        requestId: payload.requestId,
      });
      break;
  }
}

// ─── Payment Success Handler ─────────────────────────

/** Handle a payment_success event: reconcile with transaction, store tokenKey, activate subscription. */
async function handlePaymentSuccess(payload: NombaWebhookPayload): Promise<void> {
  const orderReference = payload.data.order?.orderReference;
  const requestId = payload.requestId;

  if (!orderReference) {
    logger.warn('payment_success webhook has no orderReference — cannot reconcile', {
      requestId,
    });
    return;
  }

  const transaction = await prisma.transaction.findUnique({
    where: { idempotencyKey: orderReference },
    select: {
      id: true,
      status: true,
      subscriptionId: true,
      merchantId: true,
      chargeType: true,
      subscription: {
        select: {
          id: true,
          status: true,
          customerId: true,
          plan: {
            select: { interval: true, intervalDays: true },
          },
        },
      },
    },
  });

  if (!transaction) {
    logger.warn('payment_success webhook: no matching transaction found', {
      orderReference,
      requestId,
    });
    return;
  }

  // Capture tokenized card data and persist the tokenKey for future recurring charges
  const isTokenized =
    payload.data.order?.isTokenizedCardPayment === 'true';

  if (isTokenized) {
    const cardData = extractTokenizedCardDataFromWebhook(payload);
    if (cardData?.tokenKey) {
      await prisma.customer.update({
        where: { id: transaction.subscription.customerId },
        data: { nombaTokenKey: cardData.tokenKey },
      });

      logger.info('tokenKey captured and stored from payment_success webhook', {
        subscriptionId: transaction.subscriptionId,
        customerId: transaction.subscription.customerId,
        cardType: cardData.cardType,
        cardPan: cardData.cardPan,
      });
    }
  }

  // Mark the local transaction as SUCCESS if it was still pending
  if (transaction.status === 'PENDING') {
    const nombaTransactionId = payload.data.transaction.transactionId;

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: 'SUCCESS',
        nombaReference: nombaTransactionId,
        gatewayResponse: payload.data as any,
      },
    });
  }

  const sub = transaction.subscription;

  // TRIALING → ACTIVE: first successful charge moves subscription out of trial
  if (sub.status === 'TRIALING') {
    const now = new Date();
    const newPeriodEnd = calculatePeriodEnd(
      now,
      sub.plan.interval,
      sub.plan.intervalDays,
    );

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        retryCount: 0,
        nextRetryAt: null,
      },
    });

    await transitionSubscriptionStatus({
      subscriptionId: sub.id,
      toStatus: 'ACTIVE',
      eventType: 'TRIAL_ENDED_ACTIVATED',
      metadata: {
        source: 'nomba_webhook',
        requestId,
        transactionId: transaction.id,
      },
    });

    logger.info('Subscription activated from TRIALING via webhook', {
      subscriptionId: sub.id,
      newPeriodEnd: newPeriodEnd.toISOString(),
    });
  } else if (sub.status === 'PAST_DUE') {
    // PAST_DUE → ACTIVE: dunning retry succeeded, reset billing period
    const now = new Date();
    const newPeriodEnd = calculatePeriodEnd(
      now,
      sub.plan.interval,
      sub.plan.intervalDays,
    );

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        retryCount: 0,
        nextRetryAt: null,
        lastFailureReason: null,
      },
    });

    await transitionSubscriptionStatus({
      subscriptionId: sub.id,
      toStatus: 'ACTIVE',
      eventType: 'PAYMENT_RECOVERED',
      metadata: {
        source: 'nomba_webhook',
        requestId,
        transactionId: transaction.id,
      },
    });
  }

  logger.info('payment_success webhook processed', {
    orderReference,
    subscriptionId: transaction.subscriptionId,
    subscriptionStatus: sub.status,
    isTokenized,
  });
}

// ─── Payment Failed Handler ──────────────────────────

/** Handle a payment_failed event: mark the matching transaction as FAILED. */
async function handlePaymentFailed(payload: NombaWebhookPayload): Promise<void> {
  const orderReference = payload.data.order?.orderReference;

  if (!orderReference) {
    logger.warn('payment_failed webhook has no orderReference', {
      requestId: payload.requestId,
    });
    return;
  }

  const transaction = await prisma.transaction.findUnique({
    where: { idempotencyKey: orderReference },
    select: {
      id: true,
      status: true,
      subscriptionId: true,
      subscription: { select: { id: true, status: true } },
    },
  });

  if (!transaction) {
    logger.warn('payment_failed webhook: no matching transaction found', {
      orderReference,
      requestId: payload.requestId,
    });
    return;
  }

  if (transaction.status === 'PENDING') {
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: 'FAILED',
        gatewayResponse: payload.data as any,
        failureMessage: payload.data.transaction.responseCode ?? 'Payment failed',
      },
    });

    logger.info('payment_failed webhook: transaction marked FAILED', {
      orderReference,
      subscriptionId: transaction.subscriptionId,
    });
  } else {
    logger.info('payment_failed webhook: transaction already processed by charge worker', {
      orderReference,
      existingStatus: transaction.status,
    });
  }
}
