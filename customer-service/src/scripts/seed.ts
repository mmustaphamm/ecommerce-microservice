import mongoose from 'mongoose';
import { createLogger } from '@ecommerce/shared/src';
import { env } from '../config/env';
import { CustomerModel } from '../models/Customer';

const logger = createLogger({ serviceName: 'customer-service:seed' });

export const SEED_CUSTOMERS = [
  {
    customerId: '001',
    name: 'John Doe',
    email: 'john.doe@example.com',
  },
  {
    customerId: '002',
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
  },
  {
    customerId: '003',
    name: 'Ada Lovelace',
    email: 'ada.lovelace@example.com',
  },
];

/**
 * Idempotent seed: safe to run every time the container starts (upsert on
 * customerId), so we never get duplicate-key errors on restart and never
 * need a separate "has this run before" flag.
 */
export async function seed(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);

  await CustomerModel.deleteMany({ customerId: { $in: ['cust-0001'] } });

  await Promise.all(
    SEED_CUSTOMERS.map((customer) =>
      CustomerModel.findOneAndUpdate(
        { customerId: customer.customerId },
        { $setOnInsert: customer },
        { upsert: true, new: true },
      ),
    ),
  );

  logger.info({ count: SEED_CUSTOMERS.length }, 'Seed customers ensured');
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
