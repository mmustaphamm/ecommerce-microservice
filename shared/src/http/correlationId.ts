import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

/**
 * Reads an inbound `x-correlation-id` header, or generates a new one if this
 * is the origin request. Attaches it to `req.correlationId` and echoes it back
 * on the response so the same id can be threaded through every downstream
 * service call and log line for a single logical request/order flow.
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[CORRELATION_ID_HEADER];
  const correlationId = (Array.isArray(incoming) ? incoming[0] : incoming) ?? randomUUID();

  req.correlationId = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  next();
}
