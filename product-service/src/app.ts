import express, { Express } from 'express';
import type { Logger } from 'pino';
import {
  correlationIdMiddleware,
  createErrorHandler,
  notFoundHandler,
  healthCheckHandler,
  createMetrics,
} from '@ecommerce/shared';
import { MongoProductRepository } from './repositories/MongoProductRepository';
import { ProductService } from './services/ProductService';
import { ProductController } from './controllers/ProductController';
import { createProductRoutes } from './routes/productRoutes';
import { isDatabaseConnected } from './config/database';

export function createApp(logger: Logger): Express {
  const app = express();
  app.use(express.json());
  app.use(correlationIdMiddleware);

  const { metricsMiddleware, metricsHandler } = createMetrics('product-service');
  app.use(metricsMiddleware);

  const productRepository = new MongoProductRepository();
  const productService = new ProductService(productRepository);
  const productController = new ProductController(productService);

  app.get('/health', healthCheckHandler('product-service', isDatabaseConnected));
  app.get('/metrics', metricsHandler);
  app.use('/products', createProductRoutes(productController));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
