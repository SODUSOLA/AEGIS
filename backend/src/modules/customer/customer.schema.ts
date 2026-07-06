import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination';

export const createCustomerSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email('A valid email address is required')
      .toLowerCase()
      .trim(),
    name: z.string().min(1).max(200).trim().optional(),
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{1,14}$/, 'Phone must be a valid E.164 format e.g. +2348012345678')
      .optional(),
    nombaTokenKey: z.string().min(1).trim().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

export const updateCustomerSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Customer ID is required'),
  }),
  body: z.object({
    name: z.string().min(1).max(200).trim().optional(),
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{1,14}$/, 'Phone must be a valid E.164 format e.g. +2348012345678')
      .optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

export const updatePaymentMethodSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Customer ID is required'),
  }),
  body: z.object({
    nombaTokenKey: z.string().min(1, 'nombaTokenKey is required').trim(),
  }),
});

export const getCustomerSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Customer ID is required'),
  }),
});

export const listCustomersSchema = z.object({
  query: paginationSchema.extend({
    hasToken: z
      .string()
      .optional()
      .transform((val) => {
        if (val === 'true') return true;
        if (val === 'false') return false;
        return undefined;
      }),
  }),
});

export const deleteCustomerSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Customer ID is required'),
  }),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>['body'];
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>['body'];
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>['body'];
