import { RequestHandler, Router } from 'express';
import { healthCheckHandler } from '@ecommerce/shared/src';
import { isDatabaseConnected } from '../config/database';
import { createCustomerModule } from '../modules/customerModule';

export function createRoutes(metricsHandler: RequestHandler): Router {
  const router = Router();

  router.get('/health', healthCheckHandler('customer-service', isDatabaseConnected));
  router.get('/metrics', metricsHandler);
  router.use(createCustomerModule());

  return router;
}
