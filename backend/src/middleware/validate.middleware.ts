import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../lib/errors';

/**
 * Express middleware factory that validates `req.body`, `req.params`, and `req.query`
 * against the supplied Zod schema. Replaces the raw values with the parsed (and defaulted) values.
 * Throws a ValidationError on failure.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      req.body = parsed.body ?? req.body;
      req.params = parsed.params ?? req.params;
      req.query = parsed.query ?? req.query;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new ValidationError('Validation failed', {
            errors: error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          }),
        );
      } else {
        next(error);
      }
    }
  };
}
