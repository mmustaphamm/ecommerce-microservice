import { RequestHandler, Router } from 'express';
import { healthCheckHandler } from '@ecommerce/shared/src';
import { isDatabaseConnected } from '../config/database';
import { createProductModule } from '../modules/productModule';

export function createRoutes(metricsHandler: RequestHandler): Router {
  const router = Router();

  router.get('/health', healthCheckHandler('product-service', isDatabaseConnected));
  router.get('/metrics', metricsHandler);
  router.use(createProductModule());

  return router;
}
