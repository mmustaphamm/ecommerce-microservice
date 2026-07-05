import express, { Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import {
  correlationIdMiddleware,
  createErrorHandler,
  notFoundHandler,
  createMetrics,
  Publisher,
} from '@ecommerce/shared/src';
import { createRoutes } from './routes';

/**
 * Composition root. `publisher` is injected rather than constructed here
 * because it depends on an already-open RabbitMQ channel, which is
 * established asynchronously during bootstrap (see server.ts) before the
 * Express app is created. `isRabbitMQReady` likewise comes from the
 * RabbitMQConnection created in server.ts, so /health can reflect BOTH
 * MongoDB and RabbitMQ connectivity, not just the database.
 */
export function createApp(
  logger: Logger,
  publisher: Publisher,
  isRabbitMQReady: () => boolean,
): Express {
  const app = express();
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(correlationIdMiddleware);

  const { metricsMiddleware, metricsHandler } = createMetrics('order-service');
  app.use(metricsMiddleware);

  app.use(createRoutes(logger, publisher, metricsHandler, isRabbitMQReady));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
