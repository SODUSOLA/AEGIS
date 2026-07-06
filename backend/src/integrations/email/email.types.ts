export interface BaseEmailPayload {
  customerEmail: string;
  customerName?: string;
}

export interface DunningStartedEmailPayload extends BaseEmailPayload {
  planName: string;
  amountKobo: number;
  nextRetryHours: number;
}

export interface RetryScheduledEmailPayload extends BaseEmailPayload {
  planName: string;
  amountKobo: number;
  attemptNumber: number;
  nextRetryHours: number;
}

export interface PaymentRecoveredEmailPayload extends BaseEmailPayload {
  planName: string;
  amountKobo: number;
  nextBillingDate: Date;
}

export interface UpdateCardEmailPayload extends BaseEmailPayload {
  planName: string;
  failureReason: string;
}

export interface SubscriptionSuspendedEmailPayload extends BaseEmailPayload {
  planName: string;
  totalAttempts: number;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}
