import mongoose from 'mongoose';
import { createLogger, registerGracefulShutdown } from '@ecommerce/shared/src';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { createApp } from './app';

const logger = createLogger({ serviceName: 'product-service', level: env.LOG_LEVEL });

async function bootstrap(): Promise<void> {
  await connectDatabase(logger);

  const app = createApp(logger);

  const server = app.listen(env.PORT, () => {
    logger.info(`product-service listening on port ${env.PORT}`);
  });

  registerGracefulShutdown({
    httpServer: server,
    logger,
    onShutdown: async () => {
      await mongoose.disconnect();
    },
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start product-service');
  process.exit(1);
});
