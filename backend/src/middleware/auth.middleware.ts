import { Request, Response, NextFunction } from 'express';
import { resolveMerchantFromApiKey } from '../modules/merchant/merchant.service';
import { UnauthorizedError } from '../lib/errors';
import { logger } from '../lib/logger';

/**
 * Authenticates the request using the `X-API-Key` header.
 * Validates the key prefix, resolves the merchant, and attaches it to `req.merchant`.
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedError('Missing or invalid X-API-Key header');
    }

    if (!apiKey.startsWith('ak_live_') && !apiKey.startsWith('ak_test_')) {
      throw new UnauthorizedError('Invalid API key format');
    }

    const merchant = await resolveMerchantFromApiKey(apiKey);

    if (!merchant) {
      // Log the attempt without exposing the full key
      logger.warn('Invalid API key attempt', {
        ip: req.ip,
        path: req.path,
        keyPrefix: apiKey.substring(0, 15),
      });
      throw new UnauthorizedError('Invalid or expired API key');
    }

    req.merchant = merchant;

    next();
  } catch (error) {
    next(error);
  }
}
