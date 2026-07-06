import mongoose from 'mongoose';
import { createLogger } from '@ecommerce/shared/src';
import { env } from '../config/env';
import { CustomerModel } from '../models/Customer';

const logger = createLogger({ serviceName: 'customer-service:seed' });

export const SEED_CUSTOMER = {
  customerId: 'cust-0001',
  name: 'John Doe',
  email: 'john.doe@example.com',
};

/**
 * Idempotent seed: safe to run every time the container starts (upsert on
 * customerId), so we never get duplicate-key errors on restart and never
 * need a separate "has this run before" flag.
 */
export async function seed(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);

  await CustomerModel.findOneAndUpdate(
    { customerId: SEED_CUSTOMER.customerId },
    { $setOnInsert: SEED_CUSTOMER },
    { upsert: true, new: true },
  );

  logger.info({ customerId: SEED_CUSTOMER.customerId }, 'Seed customer ensured');
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
