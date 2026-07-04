/**
 * Base class for all operational errors thrown intentionally by our services.
 *
 * "Operational" errors are expected failure modes (bad input, missing resource,
 * downstream service unavailable) as opposed to programmer bugs. Keeping them
 * as a distinct class hierarchy lets a single Express error-handling middleware
 * translate them into consistent HTTP responses across every service, instead
 * of each controller hand-rolling try/catch + status-code logic.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    // Maintains proper prototype chain when compiled down by TS/Babel.
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    super(
      identifier ? `${resource} with id '${identifier}' was not found` : `${resource} was not found`,
      404,
      'NOT_FOUND',
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

/**
 * Raised when a call to another microservice fails (network error, timeout,
 * or the downstream service itself returned an error response). Kept distinct
 * from other 5xx cases so callers can decide whether to retry / degrade gracefully.
 */
export class UpstreamServiceError extends AppError {
  constructor(serviceName: string, message: string, details?: unknown) {
    super(`Upstream service '${serviceName}' error: ${message}`, 502, 'UPSTREAM_SERVICE_ERROR', details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'An unexpected error occurred') {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}
