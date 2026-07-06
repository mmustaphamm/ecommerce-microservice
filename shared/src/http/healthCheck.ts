import { Request, Response } from 'express';

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
