import express, { Express } from 'express';
import type { Logger } from 'pino';
import {
  correlationIdMiddleware,
  createErrorHandler,
  notFoundHandler,
  healthCheckHandler,
  createMetrics,
} from '@ecommerce/shared';
import { PaymentService } from './services/PaymentService';
import { PaymentController } from './controllers/PaymentController';
import { createPaymentRoutes } from './routes/paymentRoutes';
import { ITransactionEventPublisher } from './rabbitmq/ITransactionEventPublisher';

export function createApp(
  logger: Logger,
  eventPublisher: ITransactionEventPublisher,
  isReady: () => boolean,
): Express {
  const app = express();
  app.use(express.json());
  app.use(correlationIdMiddleware);

  const { metricsMiddleware, metricsHandler } = createMetrics('payment-service');
  app.use(metricsMiddleware);

  const paymentService = new PaymentService(eventPublisher);
  const paymentController = new PaymentController(paymentService);

  app.get('/health', healthCheckHandler('payment-service', isReady));
  app.get('/metrics', metricsHandler);
  app.use('/payments', createPaymentRoutes(paymentController));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
