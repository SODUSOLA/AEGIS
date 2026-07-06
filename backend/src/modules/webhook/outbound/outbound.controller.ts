import { Request, Response, NextFunction } from 'express';
import {
  createEndpointSchema,
  updateEndpointSchema,
  getEndpointSchema,
  deleteEndpointSchema,
  listEndpointsSchema,
  listDeliveriesSchema,
} from './outbound.schema';
import {
  createWebhookEndpoint,
  listWebhookEndpoints,
  getWebhookEndpoint,
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
  listWebhookDeliveries,
} from './outbound.service';
import { successResponse } from '../../../lib/response';
import { UnauthorizedError } from '../../../lib/errors';

/** POST /webhooks/outbound/endpoints — create a new webhook endpoint. */
export async function handleCreateEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { body } = createEndpointSchema.parse({ body: req.body });
    const endpoint = await createWebhookEndpoint(req.merchant.id, body);
    res.status(201).json(successResponse(
      'Webhook endpoint created. Store the secret securely — it will not be shown again.',
      endpoint,
    ));
  } catch (error) { next(error); }
}

/** GET /webhooks/outbound/endpoints — paginated list of webhook endpoints. */
export async function handleListEndpoints(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { query } = listEndpointsSchema.parse({ query: req.query });
    const result = await listWebhookEndpoints(req.merchant.id, query.page, query.limit);
    res.status(200).json(successResponse('Webhook endpoints retrieved', result.endpoints, result.meta));
  } catch (error) { next(error); }
}

/** GET /webhooks/outbound/endpoints/:id — get a single endpoint by ID. */
export async function handleGetEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { params } = getEndpointSchema.parse({ params: req.params });
    const endpoint = await getWebhookEndpoint(req.merchant.id, params.id);
    res.status(200).json(successResponse('Webhook endpoint retrieved', endpoint));
  } catch (error) { next(error); }
}

/** PATCH /webhooks/outbound/endpoints/:id — update an existing endpoint. */
export async function handleUpdateEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { params, body } = updateEndpointSchema.parse({ params: req.params, body: req.body });
    const endpoint = await updateWebhookEndpoint(req.merchant.id, params.id, body);
    res.status(200).json(successResponse('Webhook endpoint updated', endpoint));
  } catch (error) { next(error); }
}

/** DELETE /webhooks/outbound/endpoints/:id — soft-delete a webhook endpoint. */
export async function handleDeleteEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { params } = deleteEndpointSchema.parse({ params: req.params });
    await deleteWebhookEndpoint(req.merchant.id, params.id);
    res.status(200).json(successResponse('Webhook endpoint deleted'));
  } catch (error) { next(error); }
}

/** GET /webhooks/outbound/endpoints/:id/deliveries — paginated delivery logs for an endpoint. */
export async function handleListDeliveries(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { params, query } = listDeliveriesSchema.parse({
      params: req.params,
      query: req.query,
    });
    const result = await listWebhookDeliveries(
      req.merchant.id,
      params.id,
      query.page,
      query.limit,
      query.status,
    );
    res.status(200).json(successResponse('Delivery logs retrieved', result.deliveries, result.meta));
  } catch (error) { next(error); }
}
