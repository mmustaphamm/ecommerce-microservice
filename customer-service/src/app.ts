import express, { Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import {
  correlationIdMiddleware,
  createErrorHandler,
  createMetrics,
  notFoundHandler,
} from '@ecommerce/shared/src';
import { createRoutes } from './routes';

export function createApp(logger: Logger): Express {
  const app = express();
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(correlationIdMiddleware);

  const { metricsMiddleware, metricsHandler } = createMetrics('customer-service');
  app.use(metricsMiddleware);

  app.use(createRoutes(metricsHandler));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
