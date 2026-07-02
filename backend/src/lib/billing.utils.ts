import { PlanInterval } from '@prisma/client';

export function intervalToDays(interval: PlanInterval, intervalDays?: number | null): number {
  switch (interval) {
    case 'WEEKLY':
      return 7;
    case 'MONTHLY':
      return 30;
    case 'YEARLY':
      return 365;
    case 'CUSTOM':
      if (!intervalDays || intervalDays <= 0) {
        throw new Error('intervalDays is required and must be positive for CUSTOM plans');
      }
      return intervalDays;
  }
}

export function calculatePeriodEnd(
  startDate: Date,
  interval: PlanInterval,
  intervalDays?: number | null,
): Date {
  const days = intervalToDays(interval, intervalDays);
  const end = new Date(startDate);
  end.setDate(end.getDate() + days);
  return end;
}

export function getRemainingDays(referenceDate: Date, periodEnd: Date): number {
  const msRemaining = periodEnd.getTime() - referenceDate.getTime();
  if (msRemaining <= 0) return 0;
  return msRemaining / (1000 * 60 * 60 * 24);
}

export function getTotalCycleDays(periodStart: Date, periodEnd: Date): number {
  return (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);
}

export function isBillingDue(periodEnd: Date): boolean {
  return new Date() >= periodEnd;
}

export function isTrialExpired(trialEnd: Date | null): boolean {
  if (!trialEnd) return false;
  return new Date() >= trialEnd;
}
