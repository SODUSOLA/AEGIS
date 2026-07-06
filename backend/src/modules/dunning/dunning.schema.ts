import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

const AT_RISK_STATUSES = ['PAST_DUE', 'SUSPENDED'] as const;

export const listDunningSchema = z.object({
  query: paginationSchema.extend({
    status: z.enum(AT_RISK_STATUSES).optional(),
    sortBy: z.enum(['nextRetryAt', 'createdAt', 'retryCount']).default('nextRetryAt'),
  }),
});

export const getDunningDetailSchema = z.object({
  params: z.object({
    subscriptionId: z.string().min(1, 'subscriptionId is required'),
  }),
});

export const manualRetrySchema = z.object({
  params: z.object({
    subscriptionId: z.string().min(1, 'subscriptionId is required'),
  }),
});

export const manualReactivateSchema = z.object({
  params: z.object({
    subscriptionId: z.string().min(1, 'subscriptionId is required'),
  }),
  body: z.object({
    reason: z.string().min(5).max(500).trim(),
  }),
});

export type ListDunningQuery = z.infer<typeof listDunningSchema>['query'];
export type ManualReactivateInput = z.infer<typeof manualReactivateSchema>['body'];
