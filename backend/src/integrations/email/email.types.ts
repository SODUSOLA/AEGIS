// ─── Email Payload Types ──────────────────────────────

/** Fields common to every transactional billing email. */
export interface BaseEmailPayload {
  customerEmail: string;
  customerName?: string;
}

/** Sent when a payment first fails and the dunning cycle begins. */
export interface DunningStartedEmailPayload extends BaseEmailPayload {
  planName: string;
  amountKobo: number;
  nextRetryHours: number;
}

/** Sent when a retry attempt also fails (subsequent dunning stage). */
export interface RetryScheduledEmailPayload extends BaseEmailPayload {
  planName: string;
  amountKobo: number;
  attemptNumber: number;
  nextRetryHours: number;
}

/** Sent after a successful recovery payment that brings the subscription back to active. */
export interface PaymentRecoveredEmailPayload extends BaseEmailPayload {
  planName: string;
  amountKobo: number;
  nextBillingDate: Date;
}

/** Sent when a permanent card failure forces the subscription to be paused. */
export interface UpdateCardEmailPayload extends BaseEmailPayload {
  planName: string;
  failureReason: string;
}

/** Sent when all dunning retries are exhausted and the subscription is suspended. */
export interface SubscriptionSuspendedEmailPayload extends BaseEmailPayload {
  planName: string;
  totalAttempts: number;
}

/** Raw SMTP options passed to nodemailer for every outbound message. */
export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}
