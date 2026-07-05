import { Router } from 'express';
import { OrderController } from '../controllers/OrderController';
import { validateRequest, asyncHandler, createRateLimiter, internalAuthMiddleware } from '@ecommerce/shared/src';
import { createOrderSchema, orderIdParamsSchema, updatePaymentStatusSchema } from '../middlewares/schemas';
import { env } from '../config/env';

const orderCreationRateLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });
const orderStatusRateLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });

export function createOrderRoutes(controller: OrderController): Router {
  const router = Router();

  router.post(
    '/',
    orderCreationRateLimiter,
    validateRequest(createOrderSchema, 'body'),
    asyncHandler(controller.createOrder),
  );

  router.get(
    '/:orderId/status',
    orderStatusRateLimiter,
    validateRequest(orderIdParamsSchema, 'params'),
    asyncHandler(controller.getOrderStatus),
  );

  // Internal-only: called by payment-retry-worker once a retried payment
  // attempt resolves. Never intended to be reachable by end users, hence
  // the shared-secret auth check instead of standard customer-facing routes.
  router.patch(
    '/:orderId/payment-status',
    internalAuthMiddleware(env.INTERNAL_API_KEY),
    validateRequest(orderIdParamsSchema, 'params'),
    validateRequest(updatePaymentStatusSchema, 'body'),
    asyncHandler(controller.updatePaymentStatus),
  );

  return router;
}
