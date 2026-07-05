import { Router } from 'express';
import type { Logger } from 'pino';
import { HttpClient, Publisher } from '@ecommerce/shared/src';
import { HttpCustomerClient } from '../clients/HttpCustomerClient';
import { HttpPaymentClient } from '../clients/HttpPaymentClient';
import { HttpProductClient } from '../clients/HttpProductClient';
import { env } from '../config/env';
import { OrderController } from '../controllers/OrderController';
import { MongoOrderRepository } from '../repositories/MongoOrderRepository';
import { createOrderRoutes } from '../routes/orderRoutes';
import { OrderService } from '../services/OrderService';

export function createOrderModule(logger: Logger, publisher: Publisher): Router {
  const router = Router();

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

  router.use('/orders', createOrderRoutes(orderController));

  return router;
}
