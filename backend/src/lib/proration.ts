import { getRemainingDays, getTotalCycleDays } from './billing.utils';

export interface ProratedAdjustment {
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
