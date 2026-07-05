import { RequestHandler, Router } from 'express';
import type { Logger } from 'pino';
import { healthCheckHandler, Publisher } from '@ecommerce/shared/src';
import { isDatabaseConnected } from '../config/database';
import { createOrderModule } from '../modules/orderModule';

export function createRoutes(
  logger: Logger,
  publisher: Publisher,
  metricsHandler: RequestHandler,
  isRabbitMQReady: () => boolean,
): Router {
  const router = Router();

  router.get('/health', healthCheckHandler('order-service', () => isDatabaseConnected() && isRabbitMQReady()));
  router.get('/metrics', metricsHandler);
  router.use(createOrderModule(logger, publisher));

  return router;
}
