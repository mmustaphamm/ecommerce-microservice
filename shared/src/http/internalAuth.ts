import { NextFunction, Request, Response } from 'express';

export const INTERNAL_API_KEY_HEADER = 'x-internal-api-key';

/**
 * Lightweight service-to-service authentication for internal-only endpoints
 * (e.g. the retry worker calling back into Order Service). This is NOT a
 * substitute for mTLS or a real service-mesh identity system in production -
 * it's a shared-secret header check, which is the minimum viable control to
 * stop an endpoint from being callable by anyone with network access to the
 * container. Documented explicitly as a scoped-down stand-in in the README;
 * a production system on a shared network would want mTLS or signed
 * short-lived service tokens (e.g. SPIFFE/SPIRE) instead of a static secret.
 */
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
