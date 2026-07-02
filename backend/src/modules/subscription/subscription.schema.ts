import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

const SUBSCRIPTION_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'] as const;

export const createSubscriptionSchema = z.object({
  body: z
    .object({
      customerId: z.string().min(1, 'customerId is required'),
      planId: z.string().min(1, 'planId is required'),
      trialDays: z
        .number()
        .int('trialDays must be a whole number')
        .min(0, 'trialDays cannot be negative')
        .max(365, 'trialDays cannot exceed 365')
        .default(0),
      metadata: z.record(z.unknown()).optional(),
    }),
});

export const cancelSubscriptionSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Subscription ID is required'),
  }),
  body: z.object({
    reason: z.string().max(500).trim().optional(),
  }),
});

export const changePlanSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Subscription ID is required'),
  }),
  body: z.object({
    newPlanId: z.string().min(1, 'newPlanId is required'),
  }),
});

export const getSubscriptionSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Subscription ID is required'),
  }),
});

export const listSubscriptionsSchema = z.object({
  query: paginationSchema.extend({
    status: z.enum(SUBSCRIPTION_STATUSES).optional(),
    customerId: z.string().optional(),
    planId: z.string().optional(),
  }),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>['body'];
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>['body'];
export type ChangePlanInput = z.infer<typeof changePlanSchema>['body'];
