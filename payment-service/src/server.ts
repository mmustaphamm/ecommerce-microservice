import { createLogger, registerGracefulShutdown } from '@ecommerce/shared/src';
import { env } from './config/env';
import { connectRabbitMQ, getPublisher, isRabbitMQReady, closeRabbitMQ } from './config/rabbitmq';
import { RabbitMQTransactionPublisher } from './rabbitmq/RabbitMQTransactionPublisher';
import { createApp } from './app';

const logger = createLogger({ serviceName: 'payment-service', level: env.LOG_LEVEL });

async function bootstrap(): Promise<void> {
  await connectRabbitMQ(logger);

  const eventPublisher = new RabbitMQTransactionPublisher(getPublisher());
  const app = createApp(logger, eventPublisher, isRabbitMQReady);

  const server = app.listen(env.PORT, () => {
    logger.info(`payment-service listening on port ${env.PORT}`);
  });

  registerGracefulShutdown({
    httpServer: server,
    logger,
    onShutdown: closeRabbitMQ,
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start payment-service');
  process.exit(1);
});
