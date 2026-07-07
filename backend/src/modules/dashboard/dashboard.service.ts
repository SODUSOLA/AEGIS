import { Prisma, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { getPrismaSkipTake, buildPaginationMeta } from '../../lib/pagination';

// ─── Helpers ────────────────────────────────────────

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Overview ───────────────────────────────────────

/**
 * Returns a high-level dashboard snapshot for the merchant:
 * MRR, subscription counts by health, today's charge activity,
 * and outbound webhook delivery stats.
 * All seven queries run inside a single read transaction.
 */
export async function getDashboardOverview(merchantId: string) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const result = await prisma.$transaction(async () => {
    const activeCount = await prisma.subscription.count({
      where: { merchantId, isDeleted: false, status: 'ACTIVE' },
    });

    const atRiskCount = await prisma.subscription.count({
      where: {
        merchantId,
        isDeleted: false,
        status: { in: ['ACTIVE', 'PAST_DUE'] as SubscriptionStatus[] },
        pulseScore: { lt: 50 },
      },
    });

    const suspendedCount = await prisma.subscription.count({
      where: { merchantId, isDeleted: false, status: 'SUSPENDED' },
    });

    const failedToday = await prisma.transaction.count({
      where: {
        merchantId,
        status: 'FAILED',
        createdAt: { gte: startOfToday },
      },
    });

    const successToday = await prisma.transaction.count({
      where: {
        merchantId,
        status: 'SUCCESS',
        createdAt: { gte: startOfToday },
      },
    });

    const totalDeliveries = await prisma.webhookDelivery.count({
      where: {
        endpoint: { merchantId },
        createdAt: { gte: sevenDaysAgo },
      },
    });

    const deliveredCount = await prisma.webhookDelivery.count({
      where: {
        endpoint: { merchantId },
        status: 'DELIVERED',
        createdAt: { gte: sevenDaysAgo },
      },
    });

    const activeSubscriptions = await prisma.subscription.findMany({
      where: { merchantId, isDeleted: false, status: 'ACTIVE' },
      select: { plan: { select: { amountKobo: true } } },
    });

    const mrrKobo = activeSubscriptions.reduce((sum, sub) => sum + (sub.plan?.amountKobo ?? 0), 0);

    return {
      mrrKobo,
      activeCount,
      atRiskCount,
      suspendedCount,
      failedToday,
      successToday,
      totalDeliveries,
      deliveredCount,
    };
  });

  return {
    mrr: {
      kobo: result.mrrKobo,
      naira: formatNaira(result.mrrKobo),
      formatted: formatNaira(result.mrrKobo),
    },
    subscriptions: {
      active: result.activeCount,
      atRisk: result.atRiskCount,
      suspended: result.suspendedCount,
    },
    charges: {
      failedToday: result.failedToday,
      successToday: result.successToday,
    },
    webhooks: {
      deliveryRate:
        result.totalDeliveries > 0
          ? Math.round((result.deliveredCount / result.totalDeliveries) * 100)
          : 0,
      totalLast7Days: result.totalDeliveries,
      deliveredLast7Days: result.deliveredCount,
    },
  };
}

// ─── Revenue Trend ──────────────────────────────────

/**
 * Returns daily success-transaction totals for the last 30 days.
 * Each entry contains the date, the sum in kobo, and the equivalent in naira.
 */
export async function getRevenueTrend(merchantId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const transactions = await prisma.transaction.findMany({
    where: {
      merchantId,
      status: 'SUCCESS',
      createdAt: { gte: thirtyDaysAgo },
    },
    select: { amountKobo: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const dailyMap = new Map<string, number>();

  for (const tx of transactions) {
    const day = tx.createdAt.toISOString().slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + tx.amountKobo);
  }

  const result: Array<{ date: string; amountKobo: number; amountNaira: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const day = d.toISOString().slice(0, 10);
    const amountKobo = dailyMap.get(day) ?? 0;
    result.push({ date: day, amountKobo, amountNaira: amountKobo / 100 });
  }

  return result;
}

// ─── At-Risk ────────────────────────────────────────

/**
 * Returns the 20 most at-risk subscriptions (lowest pulseScore first)
 * for subscriptions with pulseScore < 50 and status ACTIVE or PAST_DUE.
 */
export async function getAtRiskSubscriptions(merchantId: string) {
  return prisma.subscription.findMany({
    where: {
      merchantId,
      isDeleted: false,
      status: { in: ['ACTIVE', 'PAST_DUE'] as SubscriptionStatus[] },
      pulseScore: { lt: 50 },
    },
    select: {
      id: true,
      status: true,
      pulseScore: true,
      retryCount: true,
      lastFailureReason: true,
      currentPeriodEnd: true,
      plan: { select: { id: true, name: true, amountKobo: true, currency: true } },
      customer: { select: { id: true, email: true, name: true } },
    },
    orderBy: { pulseScore: 'asc' },
    take: 20,
  });
}

// ─── Subscription Board ────────────────────────────

const BOARD_SELECT = {
  id: true,
  status: true,
  pulseScore: true,
  retryCount: true,
  currentPeriodEnd: true,
  createdAt: true,
  plan: { select: { id: true, name: true, amountKobo: true, currency: true, interval: true } },
  customer: { select: { id: true, email: true, name: true } },
} as const;

export interface SubscriptionBoardQuery {
  page?: number;
  limit?: number;
  status?: string;
  sortBy?: 'pulseScore' | 'currentPeriodEnd' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated, filterable, sortable list of all subscriptions.
 * Supports filtering by status and sorting by pulseScore,
 * currentPeriodEnd, or createdAt.
 */
export async function getSubscriptionBoard(merchantId: string, query: SubscriptionBoardQuery) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const sortBy = query.sortBy ?? 'createdAt';
  const sortOrder = query.sortOrder ?? 'desc';

  const where: Prisma.SubscriptionWhereInput = {
    merchantId,
    isDeleted: false,
    ...(query.status ? { status: query.status as SubscriptionStatus } : {}),
  };

  const orderBy: Prisma.SubscriptionOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  const [subscriptions, total] = await prisma.$transaction([
    prisma.subscription.findMany({
      where,
      select: BOARD_SELECT,
      orderBy,
      ...getPrismaSkipTake(page, limit),
    }),
    prisma.subscription.count({ where }),
  ]);

  return {
    subscriptions,
    meta: buildPaginationMeta(total, page, limit),
  };
}
