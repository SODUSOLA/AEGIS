import { z } from 'zod';

/** Validates merchant registration request body — businessName (2-100 chars) and email. */
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
  }),
});

export type RegisterMerchantInput = z.infer<typeof registerMerchantSchema>['body'];
