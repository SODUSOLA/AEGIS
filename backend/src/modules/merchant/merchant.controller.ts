import { Request, Response, NextFunction } from 'express';
import { registerMerchantSchema, loginMerchantSchema } from './merchant.schema';
import { registerMerchant, loginMerchant, getMerchantById } from './merchant.service';
import { successResponse } from '../../lib/response';
import { NotFoundError, UnauthorizedError } from '../../lib/errors';

/** Register a new merchant account. Returns the merchant profile + the raw API key (one-time). */
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

/** Authenticate a merchant via email + password. Returns merchant profile + a fresh API key. */
export async function handleLoginMerchant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { body } = loginMerchantSchema.parse({ body: req.body });
    const result = await loginMerchant(body);

    res.status(200).json(
      successResponse('Login successful. Use the returned API key for subsequent requests.', result),
    );
  } catch (error) {
    next(error);
  }
}

/** Fetch the authenticated merchant's own profile. */
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
