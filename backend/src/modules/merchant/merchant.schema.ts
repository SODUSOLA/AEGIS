import { z } from 'zod';

/** Validates merchant registration request body — businessName, email, and password. */
export const registerMerchantSchema = z.object({
  body: z.object({
    businessName: z
      .string()
      .min(2, 'Business name must be at least 2 characters')
      .max(100, 'Business name must not exceed 100 characters')
      .trim(),
    email: z
      .string()
      .email('A valid email is required')
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must not exceed 128 characters'),
  }),
});

export type RegisterMerchantInput = z.infer<typeof registerMerchantSchema>['body'];

/** Validates merchant login request body — email and password. */
export const loginMerchantSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email('A valid email is required')
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(1, 'Password is required'),
  }),
});

export type LoginMerchantInput = z.infer<typeof loginMerchantSchema>['body'];
