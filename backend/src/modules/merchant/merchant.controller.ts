import { Request, Response, NextFunction } from 'express';
import { registerMerchantSchema } from './merchant.schema';
import { registerMerchant, getMerchantById } from './merchant.service';
import { successResponse } from '../../lib/response';
import { NotFoundError, UnauthorizedError } from '../../lib/errors';

export async function handleRegisterMerchant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { body } = registerMerchantSchema.parse({ body: req.body });
    const result = await registerMerchant(body);

    res.status(201).json(
      successResponse(
        'Merchant account created successfully. Store your API key securely — it will not be shown again.',
        {
          merchant: result.merchant,
          apiKey: result.apiKey,
        },
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function handleGetMerchantProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.merchant) {
      throw new UnauthorizedError();
    }

    const merchant = await getMerchantById(req.merchant.id);

    if (!merchant) {
      throw new NotFoundError('Merchant');
    }

    res.status(200).json(successResponse('Merchant profile retrieved', merchant));
  } catch (error) {
    next(error);
  }
}
