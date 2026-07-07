import { prisma } from '../db/prisma';
import { logger } from './logger';

// ─── Score Computation ─────────────────────────────

/**
 * Computes a health score (0–100) for the subscription and persists it.
 * Called after charge events and subscription status transitions.
 * DB writes are wrapped in try/catch so a score failure never breaks
 * the critical charge/transition path.
 */
export async function recalculatePulseScore(subscriptionId: string): Promise<void> {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: {
        id: true,
        status: true,
        retryCount: true,
        lastFailureReason: true,
        currentPeriodStart: true,
      },
    });

    if (!subscription) {
      logger.warn('Pulse score skipped — subscription not found', { subscriptionId });
      return;
    }

    const score = await computeScore(subscription);
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { pulseScore: score },
    });
  } catch (err) {
    logger.error('Pulse score recalculation failed', { subscriptionId, error: err });
  }
}

async function computeScore(subscription: {
  id: string;
  status: string;
  retryCount: number;
  lastFailureReason: string | null;
  currentPeriodStart: Date;
}): Promise<number> {
  let score = 100;

  // ── Status Deductions ───────────────────────────────
  if (subscription.status === 'CANCELLED' || subscription.status === 'EXPIRED') {
    return 0; // terminal states — score is zero
  }
  if (subscription.status === 'PAST_DUE') {
    score -= 20; // missed payment indicates elevated risk
  }
  if (subscription.status === 'SUSPENDED') {
    score -= 60; // severely degraded; manual intervention required
  }

  // ── Failure Reason Deductions ───────────────────────
  if (subscription.lastFailureReason) {
    switch (subscription.lastFailureReason) {
      case 'EXPIRED_CARD':
      case 'INVALID_CARD':
        score -= 30; // card data is stale — high friction to resolve
        break;
      case 'INSUFFICIENT_FUNDS':
        score -= 15; // transient balance issue, but may repeat
        break;
      case 'BANK_NETWORK_TIMEOUT':
        score -= 10; // infrastructure glitch, low penalty
        break;
      case 'DO_NOT_HONOR':
        score -= 20; // bank-level block — moderate severity
        break;
      case 'UNKNOWN':
      default:
        score -= 10; // unclassified — treat as minor
        break;
    }
  }

  // ── Retry Count Deductions ──────────────────────────
  if (subscription.retryCount >= 3) {
    score -= 30; // repeated failures suggest a systemic problem
  } else if (subscription.retryCount === 2) {
    score -= 20;
  } else if (subscription.retryCount === 1) {
    score -= 10; // first retry is normal, small penalty
  }

  // ── Recent Failure Rate ─────────────────────────────
  const recentTransactions = await prisma.transaction.findMany({
    where: {
      subscriptionId: subscription.id,
      createdAt: { gte: subscription.currentPeriodStart },
    },
    select: { status: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (recentTransactions.length >= 3) {
    const failureCount = recentTransactions.filter((tx) => tx.status === 'FAILED').length;
    const failureRate = (failureCount / recentTransactions.length) * 100;

    if (failureRate >= 80) {
      score -= 20; // overwhelming majority failed
    } else if (failureRate >= 50) {
      score -= 10; // more failed than succeeded
    }
  }

  // ── Healthy Bonus ───────────────────────────────────
  if (
    subscription.status === 'ACTIVE' &&
    subscription.retryCount === 0 &&
    recentTransactions.length >= 3 &&
    recentTransactions.every((tx) => tx.status === 'SUCCESS')
  ) {
    score += 5; // active subscription with clean history
  }

  // ── Recovery Bonus ──────────────────────────────────
  const recentEvents = await prisma.subscriptionEvent.findMany({
    where: {
      subscriptionId: subscription.id,
      eventType: 'PAYMENT_RECOVERED',
      createdAt: { gte: subscription.currentPeriodStart },
    },
    select: { id: true },
    take: 1,
  });
  if (recentEvents.length > 0) {
    score += 5; // recently recovered from past-due status
  }

  return Math.max(0, Math.min(100, score));
}

// ─── Band Lookup ───────────────────────────────────

export interface PulseScoreBand {
  label: 'healthy' | 'at_risk' | 'critical' | 'severe';
  color: string;
}

/**
 * Returns the UI-facing label and colour hex for a given pulse score.
 * Used by the dashboard to render colour-coded badges / indicators.
 */
export function getPulseScoreBand(score: number): PulseScoreBand {
  if (score >= 80) return { label: 'healthy', color: '#22C55E' };
  if (score >= 50) return { label: 'at_risk', color: '#EAB308' };
  if (score >= 25) return { label: 'critical', color: '#F97316' };
  return { label: 'severe', color: '#EF4444' };
}
