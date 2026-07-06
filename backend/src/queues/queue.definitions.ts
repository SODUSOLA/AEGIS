// ─── Queue Names ────────────────────────────────────

/** BullMQ queue names used across the billing and webhook pipeline. */
export const QUEUE_NAMES = {
  BILLING_SCHEDULER: 'billing.scheduler',
  BILLING_RENEWAL: 'billing.renewal',
  BILLING_PRORATION: 'billing.proration',
  BILLING_DUNNING: 'billing.dunning',
  WEBHOOK_OUTBOUND: 'webhook.outbound',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ─── Job Names ──────────────────────────────────────

/** Canonical job type names used when adding jobs to queues. */
export const JOB_NAMES = {
  EVALUATE_DUE_SUBSCRIPTIONS: 'evaluate-due-subscriptions',
  PROCESS_RENEWAL_CHARGE: 'process-renewal-charge',
  PROCESS_PRORATION_CHARGE: 'process-proration-charge',
  PROCESS_DUNNING_RETRY: 'process-dunning-retry',
  DELIVER_WEBHOOK: 'deliver-webhook',
} as const;

// ─── Job Data Interfaces ────────────────────────────

/** Data payload for the scheduler job (no input needed — it scans the DB). */
export type SchedulerJobData = Record<string, never>;

/** Data payload for a subscription renewal charge job. */
export interface RenewalJobData {
  subscriptionId: string;
  merchantId: string;
}

/** Data payload for a proration charge job (plan upgrade/downgrade adjustments). */
export interface ProrationJobData {
  subscriptionId: string;
  merchantId: string;
  adjustmentKobo: number;
  newPlanId: string;
  oldPlanId: string;
}

/** Data payload for a dunning retry job. */
export interface DunningJobData {
  subscriptionId: string;
  merchantId: string;
  retryAttempt: number;
}
