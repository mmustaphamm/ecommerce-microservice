import express, { Express } from 'express';
import type { Logger } from 'pino';
import {
  correlationIdMiddleware,
  createErrorHandler,
  notFoundHandler,
  healthCheckHandler,
  createMetrics,
  HttpClient,
  Publisher,
} from '@ecommerce/shared';
import { env } from './config/env';
import { isDatabaseConnected } from './config/database';
import { MongoOrderRepository } from './repositories/MongoOrderRepository';
import { HttpPaymentClient } from './clients/HttpPaymentClient';
import { HttpProductClient } from './clients/HttpProductClient';
import { HttpCustomerClient } from './clients/HttpCustomerClient';
import { OrderService } from './services/OrderService';
import { OrderController } from './controllers/OrderController';
import { createOrderRoutes } from './routes/orderRoutes';

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
  app.use(express.json());
  app.use(correlationIdMiddleware);

  const { metricsMiddleware, metricsHandler } = createMetrics('order-service');
  app.use(metricsMiddleware);

  const paymentHttpClient = new HttpClient({
    baseURL: env.PAYMENT_SERVICE_URL,
    serviceName: 'payment-service',
    logger,
    internalApiKey: env.INTERNAL_API_KEY,
  });
  const productHttpClient = new HttpClient({
    baseURL: env.PRODUCT_SERVICE_URL,
    serviceName: 'product-service',
    logger,
    internalApiKey: env.INTERNAL_API_KEY,
  });
  const customerHttpClient = new HttpClient({
    baseURL: env.CUSTOMER_SERVICE_URL,
    serviceName: 'customer-service',
    logger,
    internalApiKey: env.INTERNAL_API_KEY,
  });

  const orderRepository = new MongoOrderRepository();
  const paymentClient = new HttpPaymentClient(paymentHttpClient);
  const productClient = new HttpProductClient(productHttpClient);
  const customerClient = new HttpCustomerClient(customerHttpClient);

  const orderService = new OrderService(
    orderRepository,
    paymentClient,
    productClient,
    customerClient,
    publisher,
    logger,
  );
  const orderController = new OrderController(orderService);

  app.get('/health', healthCheckHandler('order-service', () => isDatabaseConnected() && isRabbitMQReady()));
  app.get('/metrics', metricsHandler);
  app.use('/orders', createOrderRoutes(orderController));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
