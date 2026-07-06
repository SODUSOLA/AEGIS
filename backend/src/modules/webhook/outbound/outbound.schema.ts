import { z } from 'zod';
import { AEGIS_EVENT_TYPES } from '../../../services/event.emitter';
import { paginationSchema } from '../../../lib/pagination';

export const createEndpointSchema = z.object({
  body: z.object({
    url: z
      .string()
      .url('Endpoint URL must be a valid HTTPS URL')
      .refine((url) => url.startsWith('https://'), {
        message: 'Endpoint URL must use HTTPS',
      }),
    subscribedEvents: z
      .array(z.enum(AEGIS_EVENT_TYPES))
      .min(1, 'At least one event type must be selected')
      .max(AEGIS_EVENT_TYPES.length, 'Cannot subscribe to more events than exist'),
    description: z.string().max(200).trim().optional(),
  }),
});

export const updateEndpointSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    url: z
      .string()
      .url()
      .refine((url) => url.startsWith('https://'))
      .optional(),
    subscribedEvents: z
      .array(z.enum(AEGIS_EVENT_TYPES))
      .min(1)
      .optional(),
    description: z.string().max(200).trim().optional(),
    status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  }),
});

export const getEndpointSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const deleteEndpointSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const listEndpointsSchema = z.object({
  query: paginationSchema,
});

export const listDeliveriesSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: paginationSchema.extend({
    status: z.enum(['PENDING', 'DELIVERED', 'FAILED', 'RETRYING']).optional(),
  }),
});

export type CreateEndpointInput = z.infer<typeof createEndpointSchema>['body'];
export type UpdateEndpointInput = z.infer<typeof updateEndpointSchema>['body'];
