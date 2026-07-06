import { Prisma, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';
import {
  NotFoundError,
  ForbiddenError,
  AppError,
  ConflictError,
} from '../../lib/errors';
import { getPrismaSkipTake, buildPaginationMeta } from '../../lib/pagination';
import { calculatePeriodEnd } from '../../lib/billing.utils';
import { calculateProratedAdjustment } from '../../lib/proration';
import { transitionSubscriptionStatus } from './subscription.state-machine';
import {
  CreateSubscriptionInput,
  CancelSubscriptionInput,
  ChangePlanInput,
} from './subscription.schema';
import { logger } from '../../lib/logger';

// ─── Select Fragments ──────────────────────────────

/** Full detail select including plan, customer, trial dates, billing metadata, and pulse score. */
const SUBSCRIPTION_DETAIL_SELECT = {
  id: true,
  status: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  trialStart: true,
  trialEnd: true,
  planChangedAt: true,
  balanceCreditKobo: true,
  retryCount: true,
  nextRetryAt: true,
  lastFailureReason: true,
  pulseScore: true,
  cancelledAt: true,
  cancellationReason: true,
  createdAt: true,
  updatedAt: true,
  plan: {
    select: {
      id: true,
      name: true,
      amountKobo: true,
      currency: true,
      interval: true,
      intervalDays: true,
    },
  },
  customer: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
} as const;

/** Lightweight select for list views — no trial/dunning fields. */
const SUBSCRIPTION_LIST_SELECT = {
  id: true,
  status: true,
  currentPeriodEnd: true,
  pulseScore: true,
  createdAt: true,
  plan: {
    select: { id: true, name: true, amountKobo: true, currency: true, interval: true },
  },
  customer: {
    select: { id: true, email: true, name: true },
  },
} as const;

// ─── Service Functions ─────────────────────────────

/**
 * Create a new subscription for a customer on a given plan.
 *
 * - Requires a payment method if trialDays === 0.
 * - Prevents duplicate active subscriptions for the same customer.
 * - Automatically starts in TRIALING or ACTIVE status depending on trialDays.
 */
export async function createSubscription(
  merchantId: string,
  input: CreateSubscriptionInput,
) {
  const { customerId, planId, trialDays } = input;

  const [customer, plan] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: customerId, merchantId, isDeleted: false },
      select: { id: true, nombaTokenKey: true, email: true },
    }),
    prisma.plan.findFirst({
      where: { id: planId, merchantId, isDeleted: false, isActive: true },
      select: { id: true, name: true, interval: true, intervalDays: true, amountKobo: true },
    }),
  ]);

  if (!customer) throw new NotFoundError('Customer');
  if (!plan) throw new NotFoundError('Plan');

  if (trialDays === 0 && !customer.nombaTokenKey) {
    throw new ForbiddenError(
      'This customer has no payment method on file. ' +
        'Add a Nomba token key via PATCH /customers/:id/payment-method, ' +
        'or create this subscription with trialDays > 0.',
    );
  }

  const existingActive = await prisma.subscription.findFirst({
    where: {
      customerId,
      merchantId,
      isDeleted: false,
      status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] as SubscriptionStatus[] },
    },
    select: { id: true, status: true },
  });

  if (existingActive) {
    throw new ConflictError(
      `Customer already has an ${existingActive.status} subscription. ` +
        'Cancel or expire the existing subscription before creating a new one.',
    );
  }

  const now = new Date();
  let initialStatus: 'TRIALING' | 'ACTIVE';
  let currentPeriodStart: Date;
  let currentPeriodEnd: Date;
  let trialStart: Date | null = null;
  let trialEnd: Date | null = null;

  if (trialDays > 0) {
    initialStatus = 'TRIALING';
    trialStart = now;
    trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + trialDays);
    currentPeriodStart = now;
    currentPeriodEnd = trialEnd;
  } else {
    initialStatus = 'ACTIVE';
    currentPeriodStart = now;
    currentPeriodEnd = calculatePeriodEnd(now, plan.interval, plan.intervalDays);
  }

  const [subscription] = await prisma.$transaction([
    prisma.subscription.create({
      data: {
        merchantId,
        customerId,
        planId,
        status: initialStatus,
        currentPeriodStart,
        currentPeriodEnd,
        trialStart,
        trialEnd,
        pulseScore: 100,
      },
      select: SUBSCRIPTION_DETAIL_SELECT,
    }),
  ]);

  await prisma.subscriptionEvent.create({
    data: {
      subscriptionId: subscription.id,
      eventType: initialStatus === 'TRIALING' ? 'SUBSCRIPTION_TRIALING_STARTED' : 'SUBSCRIPTION_ACTIVATED',
      fromStatus: null,
      toStatus: initialStatus,
      metadata: { planId, customerId, trialDays },
    },
  });

  logger.info('Subscription created', {
    merchantId,
    subscriptionId: subscription.id,
    status: initialStatus,
    customerId,
    planId,
  });

  return subscription;
}

/** List subscriptions for a merchant with pagination and optional filters (status, customerId, planId). */
export async function listSubscriptions(
  merchantId: string,
  page: number,
  limit: number,
  filters: { status?: string; customerId?: string; planId?: string },
) {
  const where: Prisma.SubscriptionWhereInput = {
    merchantId,
    isDeleted: false,
    ...(filters.status && { status: filters.status as any }),
    ...(filters.customerId && { customerId: filters.customerId }),
    ...(filters.planId && { planId: filters.planId }),
  };

  const [subscriptions, total] = await prisma.$transaction([
    prisma.subscription.findMany({
      where,
      select: SUBSCRIPTION_LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      ...getPrismaSkipTake(page, limit),
    }),
    prisma.subscription.count({ where }),
  ]);

  return {
    subscriptions,
    meta: buildPaginationMeta(total, page, limit),
  };
}

/** Fetch a single subscription by ID including its full detail and recent events (up to 20). */
export async function getSubscriptionById(merchantId: string, subscriptionId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, merchantId, isDeleted: false },
    select: {
      ...SUBSCRIPTION_DETAIL_SELECT,
      events: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          eventType: true,
          fromStatus: true,
          toStatus: true,
          metadata: true,
          createdAt: true,
        },
      },
    },
  });

  if (!subscription) throw new NotFoundError('Subscription');

  return subscription;
}

/**
 * Cancel a subscription (soft-termination).
 *
 * Sets cancelledAt + reason and transitions the status via the state machine.
 * Rejects if the subscription is already CANCELLED or EXPIRED.
 */
export async function cancelSubscription(
  merchantId: string,
  subscriptionId: string,
  input: CancelSubscriptionInput,
) {
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, merchantId, isDeleted: false },
    select: { id: true, status: true },
  });

  if (!subscription) throw new NotFoundError('Subscription');

  if (subscription.status === 'CANCELLED' || subscription.status === 'EXPIRED') {
    throw new AppError('Subscription is already terminated.', 422);
  }

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      cancelledAt: new Date(),
      cancellationReason: input.reason ?? null,
    },
  });

  await transitionSubscriptionStatus({
    subscriptionId,
    toStatus: 'CANCELLED',
    eventType: 'CANCELLED_BY_MERCHANT_OR_CUSTOMER',
    metadata: { reason: input.reason ?? 'No reason provided' },
  });

  logger.info('Subscription cancelled', { merchantId, subscriptionId });

  return { message: 'Subscription cancelled successfully.' };
}

/**
 * Change the plan on an active subscription.
 *
 * - Only allowed on ACTIVE subscriptions.
 * - Prorates the price difference and records a credit/charge as needed.
 * - Enqueues a background job if the customer owes a prorated charge.
 */
export async function changePlan(
  merchantId: string,
  subscriptionId: string,
  input: ChangePlanInput,
) {
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, merchantId, isDeleted: false },
    select: {
      id: true,
      status: true,
      planId: true,
      customerId: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      plan: {
        select: { id: true, name: true, amountKobo: true },
      },
    },
  });

  if (!subscription) throw new NotFoundError('Subscription');

  if (subscription.status !== 'ACTIVE') {
    throw new ForbiddenError(
      `Plan changes are only allowed on ACTIVE subscriptions. Current status is: ${subscription.status}`,
    );
  }

  if (subscription.planId === input.newPlanId) {
    throw new ConflictError('Customer is already on this plan.');
  }

  const newPlan = await prisma.plan.findFirst({
    where: { id: input.newPlanId, merchantId, isDeleted: false, isActive: true },
    select: { id: true, name: true, amountKobo: true, interval: true, intervalDays: true },
  });

  if (!newPlan) throw new NotFoundError('New Plan');

  const adjustment = calculateProratedAdjustment(
    newPlan.amountKobo,
    subscription.plan.amountKobo,
    subscription.currentPeriodStart,
    subscription.currentPeriodEnd,
    new Date(),
  );

  const now = new Date();

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      planId: input.newPlanId,
      previousPlanId: subscription.planId,
      planChangedAt: now,
      balanceCreditKobo: adjustment.requiresCredit ? Math.abs(adjustment.adjustmentKobo) : 0,
    },
  });

  await prisma.subscriptionEvent.create({
    data: {
      subscriptionId,
      eventType: 'PLAN_CHANGED',
      fromStatus: 'ACTIVE',
      toStatus: 'ACTIVE',
      metadata: {
        oldPlanId: subscription.planId,
        oldPlanName: subscription.plan.name,
        newPlanId: newPlan.id,
        newPlanName: newPlan.name,
        proratedAdjustmentKobo: adjustment.adjustmentKobo,
        requiresCharge: adjustment.requiresCharge,
        requiresCredit: adjustment.requiresCredit,
        breakdown: adjustment.breakdown,
      },
    },
  });

  if (adjustment.requiresCharge && adjustment.adjustmentKobo > 0) {
    const { getProratedChargeQueue } = await import('../../queues/queue.registry');
    await getProratedChargeQueue().add(
      'proration-charge',
      {
        subscriptionId,
        merchantId,
        adjustmentKobo: adjustment.adjustmentKobo,
        newPlanId: input.newPlanId,
        oldPlanId: subscription.planId,
      },
      {
        attempts: 2,
        backoff: { type: 'fixed', delay: 10_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    );

    logger.info('Proration charge job enqueued', {
      merchantId,
      subscriptionId,
      adjustmentKobo: adjustment.adjustmentKobo,
    });
  }

  logger.info('Plan changed', {
    merchantId,
    subscriptionId,
    fromPlan: subscription.planId,
    toPlan: newPlan.id,
    adjustmentKobo: adjustment.adjustmentKobo,
  });

  return {
    subscription: { id: subscriptionId, planId: newPlan.id, status: 'ACTIVE' },
    proration: adjustment,
    message: adjustment.requiresCharge
      ? `Plan upgraded. A prorated charge of ₦${(adjustment.adjustmentKobo / 100).toFixed(2)} will be applied.`
      : adjustment.requiresCredit
        ? `Plan downgraded. A credit of ₦${(Math.abs(adjustment.adjustmentKobo) / 100).toFixed(2)} will be applied to your next billing cycle.`
        : 'Plan changed. No proration adjustment required.',
  };
}
