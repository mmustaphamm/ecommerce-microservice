import mongoose from 'mongoose';
import { createLogger } from '@ecommerce/shared';
import { env } from '../config/env';
import { ProductModel } from '../models/Product';

const logger = createLogger({ serviceName: 'product-service:seed' });

export const SEED_PRODUCTS = [
  { productId: 'prod-0001', name: 'Wireless Mouse', price: 19.99, stock: 100 },
  { productId: 'prod-0002', name: 'Mechanical Keyboard', price: 79.99, stock: 50 },
  { productId: 'prod-0003', name: '27" Monitor', price: 249.99, stock: 30 },
  { productId: 'prod-0004', name: 'USB-C Hub', price: 34.5, stock: 75 },
];

export async function seed(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);

  await Promise.all(
    SEED_PRODUCTS.map((product) =>
      ProductModel.findOneAndUpdate(
        { productId: product.productId },
        { $setOnInsert: product },
        { upsert: true, new: true },
      ),
    ),
  );

  logger.info({ count: SEED_PRODUCTS.length }, 'Seed products ensured');
  await mongoose.disconnect();
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, 'Seed failed');
      process.exit(1);
    });
}
