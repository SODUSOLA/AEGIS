import { SUBSCRIPTION_STATUS, PLAN_INTERVAL, TRANSACTION_STATUS, MERCHANT_STATUS, CHARGE_TYPE } from '../config/constants';

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];
export type PlanInterval = (typeof PLAN_INTERVAL)[keyof typeof PLAN_INTERVAL];
export type TransactionStatus = (typeof TRANSACTION_STATUS)[keyof typeof TRANSACTION_STATUS];
export type MerchantStatus = (typeof MERCHANT_STATUS)[keyof typeof MERCHANT_STATUS];
export type ChargeType = (typeof CHARGE_TYPE)[keyof typeof CHARGE_TYPE];

export interface AuthenticatedMerchant {
  id: string;
  businessName: string;
  email: string;
  status: MerchantStatus;
}

export interface SubscriptionWithRelations {
  id: string;
  merchantId: string;
  customerId: string;
  planId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart: Date | null;
  trialEnd: Date | null;
  planChangedAt: Date | null;
  previousPlanId: string | null;
  balanceCreditKobo: number;
  retryCount: number;
  nextRetryAt: Date | null;
  lastFailureReason: string | null;
  pulseScore: number;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  expiresAt: Date | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  plan?: {
    id: string;
    name: string;
    amountKobo: number;
    currency: string;
    interval: string;
  };
  customer?: {
    id: string;
    email: string;
    name: string | null;
  };
}

export interface NombaCheckoutResponse {
  checkoutUrl: string;
  orderId: string;
  reference: string;
}

export interface NombaChargeResponse {
  success: boolean;
  transactionReference: string;
  orderId: string;
  status: string;
  message?: string;
  failureReason?: string;
}
