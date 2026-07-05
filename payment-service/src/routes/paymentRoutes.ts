import { Router } from 'express';
import { PaymentController } from '../controllers/PaymentController';
import { validateRequest, asyncHandler, internalAuthMiddleware } from '@ecommerce/shared/src';
import { initiatePaymentSchema } from '../middlewares/schemas';
import { env } from '../config/env';

export function createPaymentRoutes(controller: PaymentController): Router {
  const router = Router();

  // Internal-only: only Order Service (and the payment-retry-worker, on
  // reconciliation) should ever call this. Protected by shared-secret auth
  // rather than being a public endpoint.
  router.post(
    '/',
    internalAuthMiddleware(env.INTERNAL_API_KEY),
    validateRequest(initiatePaymentSchema),
    asyncHandler(controller.initiatePayment),
  );

  return router;
}
