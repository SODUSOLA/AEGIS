import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

const PLAN_INTERVALS = ['WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'] as const;

export const createPlanSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .min(2, 'Plan name must be at least 2 characters')
        .max(100, 'Plan name must not exceed 100 characters')
        .trim(),
      description: z.string().max(500, 'Description must not exceed 500 characters').trim().optional(),
      amountKobo: z
        .number()
        .int('Amount must be a whole number in kobo')
        .min(100, 'Minimum amount is 100 kobo (₦1)'),
      currency: z.string().length(3, 'Currency must be a 3-letter ISO code').default('NGN'),
      interval: z.enum(PLAN_INTERVALS, {
        errorMap: () => ({ message: 'interval must be WEEKLY, MONTHLY, YEARLY, or CUSTOM' }),
      }),
      intervalDays: z
        .number()
        .int('intervalDays must be a whole number')
        .min(1, 'intervalDays must be at least 1')
        .optional(),
    })
    .refine(
      (data) => {
        if (data.interval === 'CUSTOM' && !data.intervalDays) {
          return false;
        }
        return true;
      },
      { message: 'intervalDays is required when interval is CUSTOM', path: ['intervalDays'] },
    )
    .refine(
      (data) => {
        if (data.interval !== 'CUSTOM' && data.intervalDays) {
          return false;
        }
        return true;
      },
      { message: 'intervalDays should only be provided when interval is CUSTOM', path: ['intervalDays'] },
    ),
});

export const updatePlanSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Plan ID is required'),
  }),
  body: z.object({
    name: z.string().min(2).max(100).trim().optional(),
    description: z.string().max(500).trim().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const getPlanSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Plan ID is required'),
  }),
});

export const listPlansSchema = z.object({
  query: paginationSchema.extend({
    isActive: z
      .string()
      .optional()
      .transform((val) => {
        if (val === 'true') return true;
        if (val === 'false') return false;
        return undefined;
      }),
  }),
});

export const deletePlanSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Plan ID is required'),
  }),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>['body'];
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>['body'];
