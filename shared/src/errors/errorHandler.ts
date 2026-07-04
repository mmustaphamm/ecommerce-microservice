import { NextFunction, Request, Response } from 'express';
import { AppError } from './AppError';
import type { Logger } from 'pino';

export interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  correlationId?: string;
}

/**
 * Centralized Express error-handling middleware.
 *
 * Every controller simply calls `next(err)` on failure. This single place
 * decides how errors map to HTTP responses, so we never repeat
 * try/catch-and-format boilerplate in every route handler.
 *
 * Must be registered LAST, after all routes, per Express conventions.
 */
export function createErrorHandler(logger: Logger) {
  return function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction,
  ): void {
    const correlationId = req.headers['x-correlation-id'] as string | undefined;

    if (err instanceof AppError) {
      logger.warn(
        { err, correlationId, statusCode: err.statusCode, code: err.code },
        'Handled operational error',
      );

      const body: ErrorResponseBody = {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
        correlationId,
      };
      res.status(err.statusCode).json(body);
      return;
    }

    // Unexpected / programmer error - log with full detail, don't leak internals to client.
    logger.error({ err, correlationId }, 'Unhandled error');

    const body: ErrorResponseBody = {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
      correlationId,
    };
    res.status(500).json(body);
  };
}
