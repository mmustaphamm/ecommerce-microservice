import express, { Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import {
  correlationIdMiddleware,
  createErrorHandler,
  notFoundHandler,
  createMetrics,
} from '@ecommerce/shared/src';
import { ITransactionEventPublisher } from './rabbitmq/ITransactionEventPublisher';
import { createRoutes } from './routes';

export function createApp(
  logger: Logger,
  eventPublisher: ITransactionEventPublisher,
  isReady: () => boolean,
): Express {
  const app = express();
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(correlationIdMiddleware);

  const { metricsMiddleware, metricsHandler } = createMetrics('payment-service');
  app.use(metricsMiddleware);

  app.use(createRoutes(eventPublisher, metricsHandler, isReady));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
