import express, { Express } from 'express';
import type { Logger } from 'pino';
import {
  correlationIdMiddleware,
  createErrorHandler,
  notFoundHandler,
  healthCheckHandler,
} from '@ecommerce/shared';
import { MongoCustomerRepository } from './repositories/MongoCustomerRepository';
import { CustomerService } from './services/CustomerService';
import { CustomerController } from './controllers/CustomerController';
import { createCustomerRoutes } from './routes/customerRoutes';
import { isDatabaseConnected } from './config/database';

/**
 * Composition root: this is the one place where concrete implementations
 * are instantiated and wired into the classes that depend on their
 * interfaces. Every other file in the service only ever sees interfaces/
 * abstractions, which is what makes them independently testable.
 */
export function createApp(logger: Logger): Express {
  const app = express();
  app.use(express.json());
  app.use(correlationIdMiddleware);

  const customerRepository = new MongoCustomerRepository();
  const customerService = new CustomerService(customerRepository);
  const customerController = new CustomerController(customerService);

  app.get('/health', healthCheckHandler('customer-service', isDatabaseConnected));
  app.use('/customers', createCustomerRoutes(customerController));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
