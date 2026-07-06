// ─── API Key / Webhook Prefixes ───────────────────────

export const API_KEY_PREFIX = 'ak_live_' as const;
export const API_KEY_TEST_PREFIX = 'ak_test_' as const;
export const WEBHOOK_SECRET_PREFIX = 'whsec_' as const;

export const API_KEY_BYTE_LENGTH = 32;
export const WEBHOOK_SECRET_BYTE_LENGTH = 32;

// ─── Domain Enums ─────────────────────────────────────

export const SUBSCRIPTION_STATUS = {
  TRIALING: 'TRIALING',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export const PLAN_INTERVAL = {
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
  CUSTOM: 'CUSTOM',
} as const;

export const TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;

export const MERCHANT_STATUS = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export const WEBHOOK_DELIVERY_STATUS = {
  PENDING: 'PENDING',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING',
} as const;

export const CHARGE_TYPE = {
  INITIAL: 'INITIAL',
  RENEWAL: 'RENEWAL',
  RETRY: 'RETRY',
  PRORATION: 'PRORATION',
} as const;

// ─── Operational Constants ────────────────────────────

/** Dunning (payment recovery) retry configuration. */
export const DUNNING = {
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAYS_HOURS: [1, 24, 72],
} as const;

/** Exponential back-off delays (ms) for webhook delivery retries. */
export const WEBHOOK_RETRY_DELAYS_MS = [
  0,
  5 * 60 * 1000,
  30 * 60 * 1000,
  2 * 60 * 60 * 1000,
] as const;
