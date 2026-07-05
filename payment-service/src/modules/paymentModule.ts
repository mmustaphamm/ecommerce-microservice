import { Router } from 'express';
import { PaymentController } from '../controllers/PaymentController';
import { createPaymentRoutes } from '../routes/paymentRoutes';
import { ITransactionEventPublisher } from '../rabbitmq/ITransactionEventPublisher';
import { PaymentService } from '../services/PaymentService';

export function createPaymentModule(eventPublisher: ITransactionEventPublisher): Router {
  const router = Router();

  const paymentService = new PaymentService(eventPublisher);
  const paymentController = new PaymentController(paymentService);

  router.use('/payments', createPaymentRoutes(paymentController));

  return router;
}
