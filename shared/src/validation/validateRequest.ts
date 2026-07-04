import { NextFunction, Request, Response } from 'express';
import { ObjectSchema } from 'joi';
import { ValidationError } from '../errors/AppError';

type RequestPart = 'body' | 'params' | 'query';

/**
 * Builds an Express middleware that validates `req[part]` against a Joi
 * schema. On failure, throws our own `ValidationError` (caught by the shared
 * error handler) so every service returns validation failures in the same
 * shape, instead of each route hand-rolling `if (!x) return res.status(400)`.
 */
export function validateRequest(schema: ObjectSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[part], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        message: d.message,
        path: d.path,
      }));
      throw new ValidationError('Request validation failed', details);
    }

    req[part] = value;
    next();
  };
}
