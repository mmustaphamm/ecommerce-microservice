import { Router } from 'express';
import { CustomerController } from '../controllers/CustomerController';
import { validateRequest, asyncHandler } from '@ecommerce/shared';
import { getCustomerParamsSchema } from '../middlewares/schemas';

export function createCustomerRoutes(controller: CustomerController): Router {
  const router = Router();

  router.get(
    '/:customerId',
    validateRequest(getCustomerParamsSchema, 'params'),
    asyncHandler(controller.getCustomer),
  );

  return router;
}
