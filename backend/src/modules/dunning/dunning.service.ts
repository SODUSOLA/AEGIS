import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { getDunningQueue } from '../../queues/queue.registry';
import { JOB_NAMES } from '../../queues/queue.definitions';
import { transitionSubscriptionStatus } from '../subscription/subscription.state-machine';
import { NotFoundError, ForbiddenError } from '../../lib/errors';
import { getPrismaSkipTake, buildPaginationMeta } from '../../lib/pagination';
import { ListDunningQuery, ManualReactivateInput } from './dunning.schema';
import { logger } from '../../lib/logger';

// ─── Prisma Select Fragments ─────────────────────────

/** Minimal fields for the list view of at-risk subscriptions. */
const DUNNING_LIST_SELECT = {
  id: true,
  status: true,
  retryCount: true,
  nextRetryAt: true,
  lastFailureReason: true,
  currentPeriodEnd: true,
  createdAt: true,
  plan: {
    select: { id: true, name: true, amountKobo: true, currency: true, interval: true },
  },
  customer: {
    select: { id: true, email: true, name: true, phone: true },
  },
} as const;

/** Full detail select including credit balance, cancellation info, and recent events. */
const DUNNING_DETAIL_SELECT = {
  ...DUNNING_LIST_SELECT,
  balanceCreditKobo: true,
  cancelledAt: true,
  updatedAt: true,
  events: {
    orderBy: { createdAt: 'desc' as const },
    take: 30,
    select: {
      id: true,
      eventType: true,
      fromStatus: true,
      toStatus: true,
      metadata: true,
      createdAt: true,
    },
  },
} as const;

// ─── Service Functions ───────────────────────────────

/** Paginated list of at-risk (PAST_DUE / SUSPENDED) subscriptions for a merchant. */
export async function listDunningSubscriptions(
  merchantId: string,
  query: ListDunningQuery,
) {
  const where: Prisma.SubscriptionWhereInput = {
    merchantId,
    isDeleted: false,
    status: query.status
      ? { equals: query.status }
      : { in: ['PAST_DUE', 'SUSPENDED'] },
  };

  const orderBy: Prisma.SubscriptionOrderByWithRelationInput =
    query.sortBy === 'nextRetryAt'
      ? { nextRetryAt: 'asc' }
      : query.sortBy === 'retryCount'
      ? { retryCount: 'desc' }
      : { createdAt: 'desc' };

  const [subscriptions, total] = await prisma.$transaction([
    prisma.subscription.findMany({
      where,
      select: DUNNING_LIST_SELECT,
      orderBy,
      ...getPrismaSkipTake(query.page, query.limit),
    }),
    prisma.subscription.count({ where }),
  ]);

  return {
    subscriptions,
    meta: buildPaginationMeta(total, query.page, query.limit),
  };
}

/** Get full detail for a single at-risk subscription, including recent status events. */
export async function getDunningDetail(merchantId: string, subscriptionId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      merchantId,
      isDeleted: false,
      status: { in: ['PAST_DUE', 'SUSPENDED'] },
    },
    select: DUNNING_DETAIL_SELECT,
  });

  if (!subscription) throw new NotFoundError('Subscription in dunning');
  return subscription;
}

/** Enqueue an immediate retry charge for a PAST_DUE subscription. */
export async function triggerManualRetry(merchantId: string, subscriptionId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, merchantId, isDeleted: false },
    select: {
      id: true,
      status: true,
      retryCount: true,
      customer: { select: { nombaTokenKey: true } },
    },
  });

  if (!subscription) throw new NotFoundError('Subscription');

  // Only PAST_DUE subscriptions can be manually retried
  if (subscription.status !== 'PAST_DUE') {
    throw new ForbiddenError(
      `Manual retry is only available for PAST_DUE subscriptions. ` +
        `Current status: ${subscription.status}. ` +
        (subscription.status === 'SUSPENDED'
          ? 'Use POST /dunning/:id/reactivate instead.'
          : 'This subscription does not need a retry.'),
    );
  }

  if (!subscription.customer.nombaTokenKey) {
    throw new ForbiddenError(
      'This customer has no payment method on file. Ask the customer to update their card before retrying.',
    );
  }

  const dunningQueue = getDunningQueue();
  const jobId = `manual-retry:${subscriptionId}:${Date.now()}`;

  await dunningQueue.add(
    JOB_NAMES.PROCESS_DUNNING_RETRY,
    { subscriptionId, merchantId, retryAttempt: subscription.retryCount ?? 1 },
    {
      jobId,
      priority: 1,
      attempts: 1,
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 200 },
    },
  );

  await prisma.subscriptionEvent.create({
    data: {
      subscriptionId,
      eventType: 'MANUAL_RETRY_TRIGGERED',
      fromStatus: 'PAST_DUE',
      toStatus: 'PAST_DUE',
      metadata: { triggeredBy: 'merchant', jobId },
    },
  });

  logger.info('Manual dunning retry triggered', { merchantId, subscriptionId, jobId });

  return {
    message: 'Manual retry queued. The charge will be attempted immediately.',
    jobId,
  };
}

/** Reactivate a SUSPENDED subscription with a fresh billing period and reason. */
export async function manualReactivate(
  merchantId: string,
  subscriptionId: string,
  input: ManualReactivateInput,
) {
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, merchantId, isDeleted: false },
    select: {
      id: true,
      status: true,
      plan: { select: { interval: true, intervalDays: true, name: true } },
    },
  });

  if (!subscription) throw new NotFoundError('Subscription');

  if (subscription.status !== 'SUSPENDED') {
    throw new ForbiddenError(
      `Manual reactivation is only available for SUSPENDED subscriptions. ` +
        `Current status: ${subscription.status}.`,
    );
  }

  const { calculatePeriodEnd } = await import('../../lib/billing.utils');
  const now = new Date();
  const newPeriodEnd = calculatePeriodEnd(now, subscription.plan.interval, subscription.plan.intervalDays);

  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        retryCount: 0,
        nextRetryAt: null,
        lastFailureReason: null,
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
      },
    }),
  ]);

  await transitionSubscriptionStatus({
    subscriptionId,
    toStatus: 'ACTIVE',
    eventType: 'MANUALLY_REACTIVATED',
    metadata: {
      reason: input.reason,
      reactivatedBy: 'merchant',
      previousStatus: 'SUSPENDED',
      newPeriodEnd: newPeriodEnd.toISOString(),
    },
  });

  try {
    const { recalculatePulseScore } = await import('../../lib/pulse.score');
    await recalculatePulseScore(subscriptionId);
  } catch (scoreErr) {
    logger.warn('Pulse score recalculation failed after reactivation — non-critical', {
      subscriptionId, error: scoreErr,
    });
  }

  logger.info('Subscription manually reactivated', { merchantId, subscriptionId });

  return {
    message: 'Subscription reactivated successfully. Next billing date updated.',
    subscriptionId,
    newPeriodEnd,
  };
}
