import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

// ─── Constants ───────────────────────────────────────

const AT_RISK_STATUSES = ['PAST_DUE', 'SUSPENDED'] as const;

// ─── Request Schemas ─────────────────────────────────

/** List at-risk subscriptions with optional status filter and sort. */
export const listDunningSchema = z.object({
  query: paginationSchema.extend({
    status: z.enum(AT_RISK_STATUSES).optional(),
    sortBy: z.enum(['nextRetryAt', 'createdAt', 'retryCount']).default('nextRetryAt'),
  }),
});

/** Fetch detail for a single at-risk subscription. */
export const getDunningDetailSchema = z.object({
  params: z.object({
    subscriptionId: z.string().min(1, 'subscriptionId is required'),
  }),
});

/** Trigger a manual retry for a PAST_DUE subscription. */
export const manualRetrySchema = z.object({
  params: z.object({
    subscriptionId: z.string().min(1, 'subscriptionId is required'),
  }),
});

/** Reactivate a SUSPENDED subscription with a reason. */
export const manualReactivateSchema = z.object({
  params: z.object({
    subscriptionId: z.string().min(1, 'subscriptionId is required'),
  }),
  body: z.object({
    reason: z.string().min(5).max(500).trim(),
  }),
});

// ─── Inferred Types ──────────────────────────────────

export type ListDunningQuery = z.infer<typeof listDunningSchema>['query'];
export type ManualReactivateInput = z.infer<typeof manualReactivateSchema>['body'];
