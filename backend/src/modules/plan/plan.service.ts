import { Prisma, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { NotFoundError, ForbiddenError, ConflictError } from '../../lib/errors';
import { getPrismaSkipTake, buildPaginationMeta } from '../../lib/pagination';
import { CreatePlanInput, UpdatePlanInput } from './plan.schema';
import { logger } from '../../lib/logger';

// ─── Select Fragments ──────────────────────────────

/** Fields returned in plan list responses (no _count). */
const PLAN_LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  amountKobo: true,
  currency: true,
  interval: true,
  intervalDays: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const ACTIVE_STATUSES: SubscriptionStatus[] = ['TRIALING', 'ACTIVE', 'PAST_DUE'];

/** Full plan detail including active-subscription count. */
const PLAN_DETAIL_SELECT = {
  ...PLAN_LIST_SELECT,
  _count: {
    select: {
      subscriptions: {
        where: {
          isDeleted: false,
          status: { in: ACTIVE_STATUSES },
        },
      },
    },
  },
};

// ─── Service Functions ─────────────────────────────

/** Create a new pricing plan. Enforces unique plan names per merchant (case-insensitive). */
export async function createPlan(merchantId: string, input: CreatePlanInput) {
  const existing = await prisma.plan.findFirst({
    where: {
      merchantId,
      name: { equals: input.name, mode: 'insensitive' },
      isDeleted: false,
    },
    select: { id: true },
  });

  if (existing) {
    throw new ConflictError(`A plan named "${input.name}" already exists. Plan names must be unique.`);
  }

  const plan = await prisma.plan.create({
    data: {
      merchantId,
      name: input.name,
      description: input.description,
      amountKobo: input.amountKobo,
      currency: input.currency,
      interval: input.interval as any,
      intervalDays: input.intervalDays ?? null,
    },
    select: PLAN_LIST_SELECT,
  });

  logger.info('Plan created', { merchantId, planId: plan.id, name: plan.name });
  return plan;
}

/** List plans for a merchant with pagination and optional isActive filter. */
export async function listPlans(
  merchantId: string,
  page: number,
  limit: number,
  isActive?: boolean,
) {
  const where: Prisma.PlanWhereInput = {
    merchantId,
    isDeleted: false,
    ...(isActive !== undefined && { isActive }),
  };

  const [plans, total] = await prisma.$transaction([
    prisma.plan.findMany({
      where,
      select: PLAN_LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      ...getPrismaSkipTake(page, limit),
    }),
    prisma.plan.count({ where }),
  ]);

  return {
    plans,
    meta: buildPaginationMeta(total, page, limit),
  };
}

/** Fetch a single plan by ID. Throws NotFoundError if missing or deleted. */
export async function getPlanById(merchantId: string, planId: string) {
  const plan = await prisma.plan.findFirst({
    where: { id: planId, merchantId, isDeleted: false },
    select: PLAN_DETAIL_SELECT,
  });

  if (!plan) {
    throw new NotFoundError('Plan');
  }

  return plan;
}

/** Update a plan's name, description, or active status. Rejects duplicate names within the same merchant. */
export async function updatePlan(merchantId: string, planId: string, input: UpdatePlanInput) {
  const plan = await prisma.plan.findFirst({
    where: { id: planId, merchantId, isDeleted: false },
    select: { id: true },
  });

  if (!plan) {
    throw new NotFoundError('Plan');
  }

  if (input.name) {
    const duplicate = await prisma.plan.findFirst({
      where: {
        merchantId,
        name: { equals: input.name, mode: 'insensitive' },
        isDeleted: false,
        NOT: { id: planId },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictError(`A plan named "${input.name}" already exists.`);
    }
  }

  const updated = await prisma.plan.update({
    where: { id: planId },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    select: PLAN_LIST_SELECT,
  });

  logger.info('Plan updated', { merchantId, planId });
  return updated;
}

/** Soft-delete (archive) a plan. Blocked if the plan still has active subscriptions. */
export async function archivePlan(merchantId: string, planId: string) {
  const plan = await prisma.plan.findFirst({
    where: { id: planId, merchantId, isDeleted: false },
    select: { id: true, name: true },
  });

  if (!plan) {
    throw new NotFoundError('Plan');
  }

  const activeSubscriptionCount = await prisma.subscription.count({
    where: {
      planId,
      merchantId,
      isDeleted: false,
      status: { in: ACTIVE_STATUSES },
    },
  });

  if (activeSubscriptionCount > 0) {
    throw new ForbiddenError(
      `Cannot archive plan "${plan.name}" — it has ${activeSubscriptionCount} active subscription(s). ` +
        'Migrate customers to a new plan before archiving.',
    );
  }

  await prisma.plan.update({
    where: { id: planId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      isActive: false,
    },
  });

  logger.info('Plan archived', { merchantId, planId });
}
