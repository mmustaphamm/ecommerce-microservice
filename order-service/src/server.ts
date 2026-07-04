import mongoose from 'mongoose';
import {
  createLogger,
  RabbitMQConnection,
  Publisher,
  assertPaymentRetryTopology,
  registerGracefulShutdown,
} from '@ecommerce/shared';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { createApp } from './app';

const logger = createLogger({ serviceName: 'order-service', level: env.LOG_LEVEL });

async function bootstrap(): Promise<void> {
  await connectDatabase(logger);

  const rabbitConnection = new RabbitMQConnection({ url: env.RABBITMQ_URL, logger });
  const channel = await rabbitConnection.connect();
  await assertPaymentRetryTopology(channel);
  const publisher = new Publisher(channel, logger);

  const app = createApp(logger, publisher, () => rabbitConnection.isConnected());

  const server = app.listen(env.PORT, () => {
    logger.info(`order-service listening on port ${env.PORT}`);
  });

  registerGracefulShutdown({
    httpServer: server,
    logger,
    onShutdown: async () => {
      await rabbitConnection.close();
      await mongoose.disconnect();
    },
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start order-service');
  process.exit(1);
});
