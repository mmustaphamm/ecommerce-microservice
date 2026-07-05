import { Router } from 'express';
import { ProductController } from '../controllers/ProductController';
import {
  validateRequest,
  asyncHandler,
  createRateLimiter,
  internalAuthMiddleware,
} from '@ecommerce/shared/src';
import {
  getProductParamsSchema,
  listProductsQuerySchema,
  stockMutationSchema,
} from '../middlewares/schemas';
import { env } from '../config/env';

const productReadRateLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });
const stockMutationRateLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

export function createProductRoutes(controller: ProductController): Router {
  const router = Router();

  router.get(
    '/',
    productReadRateLimiter,
    validateRequest(listProductsQuerySchema, 'query'),
    asyncHandler(controller.listProducts),
  );

  router.get(
    '/:productId',
    productReadRateLimiter,
    validateRequest(getProductParamsSchema, 'params'),
    asyncHandler(controller.getProduct),
  );

  // Internal-only: called by Order Service to atomically reserve/release
  // stock. Protected by shared-secret auth since these mutate inventory
  // and should never be reachable directly by end users.
  router.patch(
    '/:productId/reserve',
    stockMutationRateLimiter,
    internalAuthMiddleware(env.INTERNAL_API_KEY),
    validateRequest(getProductParamsSchema, 'params'),
    validateRequest(stockMutationSchema, 'body'),
    asyncHandler(controller.reserveStock),
  );

  router.patch(
    '/:productId/release',
    stockMutationRateLimiter,
    internalAuthMiddleware(env.INTERNAL_API_KEY),
    validateRequest(getProductParamsSchema, 'params'),
    validateRequest(stockMutationSchema, 'body'),
    asyncHandler(controller.releaseStock),
  );

  return router;
}
