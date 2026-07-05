import { Router } from 'express';
import { CustomerController } from '../controllers/CustomerController';
import {
  validateRequest,
  asyncHandler,
  createRateLimiter,
  internalAuthMiddleware,
} from '@ecommerce/shared/src';
import { env } from '../config/env';
import { getCustomerParamsSchema } from '../middlewares/schemas';

const customerLookupRateLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

export function createCustomerRoutes(controller: CustomerController): Router {
  const router = Router();

  router.get(
    '/:customerId',
    customerLookupRateLimiter,
    internalAuthMiddleware(env.INTERNAL_API_KEY),
    validateRequest(getCustomerParamsSchema, 'params'),
    asyncHandler(controller.getCustomer),
  );

  return router;
}
