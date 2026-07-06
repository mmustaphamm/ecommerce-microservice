import { NextFunction, Request, Response } from 'express';
import client from 'prom-client';

export function createMetrics(serviceName: string) {
  const register = new client.Registry();
  register.setDefaultLabels({ service: serviceName });
  client.collectDefaultMetrics({ register });

  const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests received',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [register],
  });

  function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
    res.on('finish', () => {
      httpRequestsTotal.inc({
        method: req.method,
        route: req.route?.path ?? req.path,
        status: res.statusCode,
      });
    });
    next();
  }

  async function metricsHandler(_req: Request, res: Response): Promise<void> {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  }

  return {  metricsMiddleware, metricsHandler, register };
}
