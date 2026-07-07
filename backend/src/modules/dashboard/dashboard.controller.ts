import { Request, Response, NextFunction } from 'express';
import {
  getDashboardOverview,
  getRevenueTrend,
  getAtRiskSubscriptions,
  getSubscriptionBoard,
} from './dashboard.service';
import { successResponse } from '../../lib/response';
import { UnauthorizedError } from '../../lib/errors';

/** GET /dashboard/overview — full merchant dashboard snapshot. */
export async function handleGetOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const data = await getDashboardOverview(req.merchant.id);
    res.status(200).json(successResponse('Dashboard overview retrieved', data));
  } catch (error) { next(error); }
}

/** GET /dashboard/revenue — daily revenue trend for the last 30 days. */
export async function handleGetRevenueTrend(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const data = await getRevenueTrend(req.merchant.id);
    res.status(200).json(successResponse('Revenue trend retrieved', data));
  } catch (error) { next(error); }
}

/** GET /dashboard/at-risk — top 20 subscriptions with pulseScore < 50. */
export async function handleGetAtRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const data = await getAtRiskSubscriptions(req.merchant.id);
    res.status(200).json(successResponse('At-risk subscriptions retrieved', data));
  } catch (error) { next(error); }
}

/** GET /dashboard/subscriptions — paginated, filterable, sortable subscription board. */
export async function handleGetSubscriptionBoard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { page, limit, status, sortBy, sortOrder } = req.query as any;
    const data = await getSubscriptionBoard(req.merchant.id, { page, limit, status, sortBy, sortOrder });
    res.status(200).json(successResponse('Subscription board retrieved', data.subscriptions, data.meta));
  } catch (error) { next(error); }
}
