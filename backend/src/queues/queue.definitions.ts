export const QUEUE_NAMES = {
  BILLING_SCHEDULER: 'billing.scheduler',
  BILLING_RENEWAL: 'billing.renewal',
  BILLING_PRORATION: 'billing.proration',
  BILLING_DUNNING: 'billing.dunning',
  WEBHOOK_OUTBOUND: 'webhook.outbound',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  EVALUATE_DUE_SUBSCRIPTIONS: 'evaluate-due-subscriptions',
  PROCESS_RENEWAL_CHARGE: 'process-renewal-charge',
  PROCESS_PRORATION_CHARGE: 'process-proration-charge',
  PROCESS_DUNNING_RETRY: 'process-dunning-retry',
  DELIVER_WEBHOOK: 'deliver-webhook',
} as const;

export type SchedulerJobData = Record<string, never>;

export interface RenewalJobData {
  subscriptionId: string;
  merchantId: string;
}

export interface ProrationJobData {
  subscriptionId: string;
  merchantId: string;
  adjustmentKobo: number;
  newPlanId: string;
  oldPlanId: string;
}

export interface DunningJobData {
  subscriptionId: string;
  merchantId: string;
  retryAttempt: number;
}
