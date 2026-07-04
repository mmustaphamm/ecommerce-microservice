import { Request, Response } from 'express';

/**
 * Simple health check handler for `GET /health`. Used by docker-compose
 * healthchecks and manual verification that a service is up and its
 * dependencies (DB connection etc.) are ready.
 */
export function healthCheckHandler(serviceName: string, isReady: () => boolean) {
  return (_req: Request, res: Response): void => {
    const ready = isReady();
    res.status(ready ? 200 : 503).json({
      service: serviceName,
      status: ready ? 'ok' : 'not_ready',
      timestamp: new Date().toISOString(),
    });
  };
}
