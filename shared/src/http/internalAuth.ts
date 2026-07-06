import { NextFunction, Request, Response } from 'express';

export const INTERNAL_API_KEY_HEADER = 'x-internal-api-key';

export function internalAuthMiddleware(expectedKey: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const provided = req.headers[INTERNAL_API_KEY_HEADER];

    if (provided !== expectedKey) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'This endpoint is for internal service-to-service use only',
        },
      });
      return;
    }

    next();
  };
}
