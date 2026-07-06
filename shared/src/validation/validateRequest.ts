import { NextFunction, Request, Response } from 'express';
import { ObjectSchema } from 'joi';
import { ValidationError } from '../errors/AppError';

type RequestPart = 'body' | 'params' | 'query';

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
