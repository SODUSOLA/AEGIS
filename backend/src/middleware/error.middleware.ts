import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../lib/errors';
import { logger } from '../lib/logger';
import { errorResponse } from '../lib/response';

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(422).json(
      errorResponse('Validation failed', {
        errors: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }),
    );
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('Operational error', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
      });
    }

    res.status(err.statusCode).json(
      errorResponse(
        err.message,
        err instanceof ValidationError ? { errors: err.errors } : undefined,
      ),
    );
    return;
  }

  logger.error('Unexpected error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json(errorResponse('An unexpected error occurred. Please try again.'));
}
