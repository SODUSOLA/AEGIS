import { getRemainingDays, getTotalCycleDays } from './billing.utils';

/** Result of a prorated plan-change calculation. */
export interface ProratedAdjustment {
  /** Positive = charge this amount, negative = credit this amount (in kobo). */
  adjustmentKobo: number;
  requiresCharge: boolean;
  requiresCredit: boolean;
  breakdown: {
    newPlanAmountKobo: number;
    oldPlanAmountKobo: number;
    remainingDays: number;
    totalCycleDays: number;
    calculatedAt: string;
  };
}

/**
 * Computes the prorated difference when switching between two plans mid-cycle.
 * Adjusts for the remaining days in the current period so the merchant only pays
 * (or is credited) for the fraction of the cycle they actually use.
 */
export function calculateProratedAdjustment(
  newPlanAmountKobo: number,
  oldPlanAmountKobo: number,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  changeDate: Date = new Date(),
): ProratedAdjustment {
  const remainingDays = getRemainingDays(changeDate, currentPeriodEnd);
  const totalCycleDays = getTotalCycleDays(currentPeriodStart, currentPeriodEnd);

  if (totalCycleDays <= 0) {
    throw new Error('Invalid billing period: totalCycleDays must be greater than 0');
  }

  const adjustmentKobo = Math.round(
    (newPlanAmountKobo - oldPlanAmountKobo) * (remainingDays / totalCycleDays),
  );

  return {
    adjustmentKobo,
    requiresCharge: adjustmentKobo > 0,
    requiresCredit: adjustmentKobo < 0,
    breakdown: {
      newPlanAmountKobo,
      oldPlanAmountKobo,
      remainingDays: parseFloat(remainingDays.toFixed(4)),
      totalCycleDays: parseFloat(totalCycleDays.toFixed(4)),
      calculatedAt: changeDate.toISOString(),
    },
  };
}
