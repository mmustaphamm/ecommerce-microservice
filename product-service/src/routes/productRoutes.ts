import { Router } from 'express';
import { ProductController } from '../controllers/ProductController';
import { validateRequest, asyncHandler, internalAuthMiddleware } from '@ecommerce/shared';
import {
  getProductParamsSchema,
  listProductsQuerySchema,
  stockMutationSchema,
} from '../middlewares/schemas';
import { env } from '../config/env';

export function createProductRoutes(controller: ProductController): Router {
  const router = Router();

  router.get('/', validateRequest(listProductsQuerySchema, 'query'), asyncHandler(controller.listProducts));

  router.get(
    '/:productId',
    validateRequest(getProductParamsSchema, 'params'),
    asyncHandler(controller.getProduct),
  );

  // Internal-only: called by Order Service to atomically reserve/release
  // stock. Protected by shared-secret auth since these mutate inventory
  // and should never be reachable directly by end users.
  router.patch(
    '/:productId/reserve',
    internalAuthMiddleware(env.INTERNAL_API_KEY),
    validateRequest(getProductParamsSchema, 'params'),
    validateRequest(stockMutationSchema, 'body'),
    asyncHandler(controller.reserveStock),
  );

  router.patch(
    '/:productId/release',
    internalAuthMiddleware(env.INTERNAL_API_KEY),
    validateRequest(getProductParamsSchema, 'params'),
    validateRequest(stockMutationSchema, 'body'),
    asyncHandler(controller.releaseStock),
  );

  return router;
}
