import { RequestHandler, Router } from 'express';
import { healthCheckHandler } from '@ecommerce/shared/src';
import { ITransactionEventPublisher } from '../rabbitmq/ITransactionEventPublisher';
import { createPaymentModule } from '../modules/paymentModule';

export function createRoutes(
  eventPublisher: ITransactionEventPublisher,
  metricsHandler: RequestHandler,
  isReady: () => boolean,
): Router {
  const router = Router();

  router.get('/health', healthCheckHandler('payment-service', isReady));
  router.get('/metrics', metricsHandler);
  router.use(createPaymentModule(eventPublisher));

  return router;
}
