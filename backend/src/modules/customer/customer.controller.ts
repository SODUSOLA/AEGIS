import { Request, Response, NextFunction } from 'express';
import {createCustomerSchema, updateCustomerSchema, getCustomerSchema, listCustomersSchema, deleteCustomerSchema, updatePaymentMethodSchema} from './customer.schema';
import { createCustomer, listCustomers, getCustomerById, updateCustomer, updatePaymentMethod,  deleteCustomer} from './customer.service';
import { successResponse } from '../../lib/response';
import { UnauthorizedError } from '../../lib/errors';

// Customer creation logic
export async function handleCreateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { body } = createCustomerSchema.parse({ body: req.body });
    const customer = await createCustomer(req.merchant.id, body);
    res.status(201).json(successResponse('Customer created successfully', customer));
  } catch (error) {
    next(error);
  }
}


export async function handleListCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { query } = listCustomersSchema.parse({ query: req.query });
    const result = await listCustomers(req.merchant.id, query.page, query.limit, query.hasToken);
    res.status(200).json(successResponse('Customers retrieved', result.customers, result.meta));
  } catch (error) {
    next(error);
  }
}

export async function handleGetCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { params } = getCustomerSchema.parse({ params: req.params });
    const customer = await getCustomerById(req.merchant.id, params.id);
    res.status(200).json(successResponse('Customer retrieved', customer));
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { params, body } = updateCustomerSchema.parse({ params: req.params, body: req.body });
    const customer = await updateCustomer(req.merchant.id, params.id, body);
    res.status(200).json(successResponse('Customer updated successfully', customer));
  } catch (error) {
    next(error);
  }
}

export async function handleUpdatePaymentMethod(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { params, body } = updatePaymentMethodSchema.parse({ params: req.params, body: req.body });
    const result = await updatePaymentMethod(req.merchant.id, params.id, body);
    res.status(200).json(successResponse(result.message));
  } catch (error) {
    next(error);
  }
}

export async function handleDeleteCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.merchant) throw new UnauthorizedError();
    const { params } = deleteCustomerSchema.parse({ params: req.params });
    await deleteCustomer(req.merchant.id, params.id);
    res.status(200).json(successResponse('Customer deleted successfully'));
  } catch (error) {
    next(error);
  }
}
