import { Request, Response, NextFunction } from 'express';
import {
  listDunningSchema,
  getDunningDetailSchema,
  manualRetrySchema,
  manualReactivateSchema,
} from './dunning.schema';
import {
  listDunningSubscriptions,
  getDunningDetail,
  triggerManualRetry,
  manualReactivate,
} from './dunning.service';
import { successResponse } from '../../lib/response';
import { UnauthorizedError } from '../../lib/errors';

/** GET /dunning — list at-risk subscriptions for the authenticated merchant. */
export async function handleListDunning(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { query } = listDunningSchema.parse({ query: req.query });
    const result = await listDunningSubscriptions(req.merchant.id, query);
    res.status(200).json(successResponse('At-risk subscriptions retrieved', result.subscriptions, result.meta));
  } catch (error) { next(error); }
}

/** GET /dunning/:subscriptionId — fetch full dunning detail for a specific subscription. */
export async function handleGetDunningDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { params } = getDunningDetailSchema.parse({ params: req.params });
    const subscription = await getDunningDetail(req.merchant.id, params.subscriptionId);
    res.status(200).json(successResponse('Dunning detail retrieved', subscription));
  } catch (error) { next(error); }
}

/** POST /dunning/:subscriptionId/retry — manually trigger a retry charge for a PAST_DUE subscription. */
export async function handleManualRetry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { params } = manualRetrySchema.parse({ params: req.params });
    const result = await triggerManualRetry(req.merchant.id, params.subscriptionId);
    res.status(202).json(successResponse(result.message, { jobId: result.jobId }));
  } catch (error) { next(error); }
}

/** POST /dunning/:subscriptionId/reactivate — reactivate a SUSPENDED subscription with a reason. */
export async function handleManualReactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { params, body } = manualReactivateSchema.parse({ params: req.params, body: req.body });
    const result = await manualReactivate(req.merchant.id, params.subscriptionId, body);
    res.status(200).json(successResponse(result.message, result));
  } catch (error) { next(error); }
}
