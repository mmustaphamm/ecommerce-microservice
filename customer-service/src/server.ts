import { createLogger } from '@ecommerce/shared';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { createApp } from './app';

const logger = createLogger({ serviceName: 'customer-service', level: env.LOG_LEVEL });

async function bootstrap(): Promise<void> {
  await connectDatabase(logger);

  const app = createApp(logger);

  app.listen(env.PORT, () => {
    logger.info(`customer-service listening on port ${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start customer-service');
  process.exit(1);
});
