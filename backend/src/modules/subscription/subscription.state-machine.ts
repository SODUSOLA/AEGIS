import { Prisma, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { emitWebhookEvent } from '../../services/event.emitter';

// ─── State Transitions ─────────────────────────────

/**
 * Allowed status transitions. Each key maps to the list of statuses it can move to.
 * Terminal states (CANCELLED, EXPIRED) have no outgoing transitions.
 */
const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  TRIALING:  ['ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'],
  ACTIVE:    ['PAST_DUE', 'CANCELLED', 'EXPIRED'],
  PAST_DUE:  ['ACTIVE', 'SUSPENDED', 'CANCELLED'],
  SUSPENDED: ['ACTIVE', 'CANCELLED'],
  CANCELLED: [],
  EXPIRED:   [],
};

// ─── Types ─────────────────────────────────────────

export interface TransitionOptions {
  subscriptionId: string;
  toStatus: SubscriptionStatus;
  metadata?: Record<string, unknown>;
  eventType?: string;
}

// ─── State Machine ─────────────────────────────────

/**
 * Transition a subscription from its current status to a new status.
 *
 * - Validates the transition against VALID_TRANSITIONS.
 * - Skips if the subscription is already in the target state.
 * - Persists both the status update and a SubscriptionEvent in a transaction.
 * - Fires a webhook event asynchronously (errors are logged, never thrown).
 */
export async function transitionSubscriptionStatus(options: TransitionOptions) {
  const { subscriptionId, toStatus, metadata, eventType } = options;

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, status: true, merchantId: true },
  });

  if (!subscription) {
    throw new AppError(`Subscription ${subscriptionId} not found`, 404);
  }

  const fromStatus = subscription.status;

  const allowedTargets = VALID_TRANSITIONS[fromStatus];
  if (!allowedTargets.includes(toStatus)) {
    throw new AppError(
      `Invalid state transition: ${fromStatus} → ${toStatus} is not permitted.`,
      422,
    );
  }

  if (fromStatus === toStatus) {
    logger.warn('Subscription transition skipped — already in target state', {
      subscriptionId,
      status: fromStatus,
    });
    return subscription;
  }

  const resolvedEventType = eventType ?? deriveEventType(fromStatus, toStatus);

  const [updatedSubscription] = await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: toStatus },
    }),
    prisma.subscriptionEvent.create({
      data: {
        subscriptionId,
        eventType: resolvedEventType,
        fromStatus,
        toStatus,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
    }),
  ]);

  logger.info('Subscription status transitioned', {
    subscriptionId,
    merchantId: subscription.merchantId,
    from: fromStatus,
    to: toStatus,
    eventType: resolvedEventType,
  });

  emitWebhookEvent({
    merchantId: subscription.merchantId,
    subscriptionId,
    stateEventType: resolvedEventType,
    metadata: metadata ?? {},
  }).catch((err) => {
    logger.error('Unexpected error in emitWebhookEvent — should never throw', {
      subscriptionId,
      eventType: resolvedEventType,
      error: err,
    });
  });

  return updatedSubscription;
}

// ─── Event Derivation ──────────────────────────────

/** Map a (from → to) status pair to a human-readable event type string. Falls back to a generic pattern. */
function deriveEventType(from: SubscriptionStatus, to: SubscriptionStatus): string {
  const map: Partial<Record<string, string>> = {
    'TRIALING→ACTIVE':    'TRIAL_ENDED_ACTIVATED',
    'TRIALING→PAST_DUE':  'TRIAL_ENDED_PAYMENT_FAILED',
    'TRIALING→CANCELLED': 'CANCELLED_DURING_TRIAL',
    'ACTIVE→PAST_DUE':    'RENEWAL_PAYMENT_FAILED',
    'ACTIVE→CANCELLED':   'CANCELLED_BY_MERCHANT_OR_CUSTOMER',
    'ACTIVE→EXPIRED':     'SUBSCRIPTION_EXPIRED',
    'PAST_DUE→ACTIVE':    'PAYMENT_RECOVERED',
    'PAST_DUE→SUSPENDED': 'DUNNING_EXHAUSTED',
    'PAST_DUE→CANCELLED': 'CANCELLED_WHILE_PAST_DUE',
    'SUSPENDED→ACTIVE':   'MANUALLY_REACTIVATED',
    'SUSPENDED→CANCELLED':'CANCELLED_WHILE_SUSPENDED',
  };

  return map[`${from}→${to}`] ?? `TRANSITIONED_${from}_TO_${to}`;
}
