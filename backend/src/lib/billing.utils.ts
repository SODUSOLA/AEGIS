import { PlanInterval } from '@prisma/client';

/** Converts a PlanInterval enum into its duration in days. For CUSTOM plans, intervalDays must be provided. */
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

/** Calculates the period-end date given a start date and billing interval. */
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

/** Returns the number of whole/partial days remaining between referenceDate and periodEnd. */
export function getRemainingDays(referenceDate: Date, periodEnd: Date): number {
  const msRemaining = periodEnd.getTime() - referenceDate.getTime();
  if (msRemaining <= 0) return 0;
  return msRemaining / (1000 * 60 * 60 * 24);
}

/** Total days spanned by a full billing cycle. */
export function getTotalCycleDays(periodStart: Date, periodEnd: Date): number {
  return (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);
}

/** Returns true if the current time has passed the billing period end. */
export function isBillingDue(periodEnd: Date): boolean {
  return new Date() >= periodEnd;
}

/** Returns true if the trial period has ended (or null trial is treated as not expired). */
export function isTrialExpired(trialEnd: Date | null): boolean {
  if (!trialEnd) return false;
  return new Date() >= trialEnd;
}
