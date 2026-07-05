import { Router } from 'express';
import { ProductController } from '../controllers/ProductController';
import { MongoProductRepository } from '../repositories/MongoProductRepository';
import { createProductRoutes } from '../routes/productRoutes';
import { ProductService } from '../services/ProductService';

export function createProductModule(): Router {
  const router = Router();

  const productRepository = new MongoProductRepository();
  const productService = new ProductService(productRepository);
  const productController = new ProductController(productService);

  router.use('/products', createProductRoutes(productController));

  return router;
}
