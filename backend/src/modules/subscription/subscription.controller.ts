import { Request, Response, NextFunction } from 'express';
import {
  createSubscriptionSchema,
  cancelSubscriptionSchema,
  changePlanSchema,
  getSubscriptionSchema,
  listSubscriptionsSchema,
} from './subscription.schema';
import {
  createSubscription,
  listSubscriptions,
  getSubscriptionById,
  cancelSubscription,
  changePlan,
} from './subscription.service';
import { successResponse } from '../../lib/response';
import { UnauthorizedError } from '../../lib/errors';

/** Create a new subscription linking a customer to a plan. */
export async function handleCreateSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { body } = createSubscriptionSchema.parse({ body: req.body });
    const subscription = await createSubscription(req.merchant.id, body);
    res.status(201).json(successResponse('Subscription created successfully', subscription));
  } catch (error) {
    next(error);
  }
}

/** List subscriptions with pagination and optional status/customerId/planId filters. */
export async function handleListSubscriptions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { query } = listSubscriptionsSchema.parse({ query: req.query });
    const { page, limit, ...filters } = query;
    const result = await listSubscriptions(req.merchant.id, page, limit, filters);
    res.status(200).json(successResponse('Subscriptions retrieved', result.subscriptions, result.meta));
  } catch (error) {
    next(error);
  }
}

/** Fetch a single subscription by ID with full detail and event history. */
export async function handleGetSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { params } = getSubscriptionSchema.parse({ params: req.params });
    const subscription = await getSubscriptionById(req.merchant.id, params.id);
    res.status(200).json(successResponse('Subscription retrieved', subscription));
  } catch (error) {
    next(error);
  }
}

/** Cancel an active/trialing/past-due subscription. */
export async function handleCancelSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { params, body } = cancelSubscriptionSchema.parse({ params: req.params, body: req.body });
    const result = await cancelSubscription(req.merchant.id, params.id, body);
    res.status(200).json(successResponse(result.message));
  } catch (error) {
    next(error);
  }
}

/** Change the plan on an active subscription with proration. */
export async function handleChangePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { params, body } = changePlanSchema.parse({ params: req.params, body: req.body });
    const result = await changePlan(req.merchant.id, params.id, body);
    res.status(200).json(successResponse(result.message, result));
  } catch (error) {
    next(error);
  }
}
