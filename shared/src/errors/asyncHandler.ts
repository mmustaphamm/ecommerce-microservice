import { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wraps an async Express route handler so rejected promises are forwarded to
 * `next(err)` automatically. Without this, every controller would need its
 * own try/catch just to route errors to the error-handling middleware.
 */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

/** Fallback handler for unmatched routes. Register before the error handler. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `No route found for ${req.method} ${req.originalUrl}`,
    },
  });
}
