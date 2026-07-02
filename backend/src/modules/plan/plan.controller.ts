import { Request, Response, NextFunction } from 'express';
import {
  createPlanSchema,
  updatePlanSchema,
  getPlanSchema,
  listPlansSchema,
  deletePlanSchema,
} from './plan.schema';
import {
  createPlan,
  listPlans,
  getPlanById,
  updatePlan,
  archivePlan,
} from './plan.service';
import { successResponse } from '../../lib/response';
import { UnauthorizedError } from '../../lib/errors';

export async function handleCreatePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { body } = createPlanSchema.parse({ body: req.body });
    const plan = await createPlan(req.merchant.id, body);
    res.status(201).json(successResponse('Plan created successfully', plan));
  } catch (error) {
    next(error);
  }
}

export async function handleListPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { query } = listPlansSchema.parse({ query: req.query });
    const result = await listPlans(req.merchant.id, query.page, query.limit, query.isActive);
    res.status(200).json(successResponse('Plans retrieved', result.plans, result.meta));
  } catch (error) {
    next(error);
  }
}

export async function handleGetPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { params } = getPlanSchema.parse({ params: req.params });
    const plan = await getPlanById(req.merchant.id, params.id);
    res.status(200).json(successResponse('Plan retrieved', plan));
  } catch (error) {
    next(error);
  }
}

export async function handleUpdatePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { params, body } = updatePlanSchema.parse({ params: req.params, body: req.body });
    const plan = await updatePlan(req.merchant.id, params.id, body);
    res.status(200).json(successResponse('Plan updated successfully', plan));
  } catch (error) {
    next(error);
  }
}

export async function handleArchivePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { params } = deletePlanSchema.parse({ params: req.params });
    await archivePlan(req.merchant.id, params.id);
    res.status(200).json(successResponse('Plan archived successfully'));
  } catch (error) {
    next(error);
  }
}
