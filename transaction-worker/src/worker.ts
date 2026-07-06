import mongoose from 'mongoose';
import {
  createLogger,
  RabbitMQConnection,
  Consumer,
  assertTransactionTopology,
  registerGracefulShutdown,
  TOPOLOGY,
  TransactionCreatedEvent,
} from '@ecommerce/shared';
import { env } from './config/env';
import { connectDatabase, isDatabaseConnected } from './config/database';
import { MongoTransactionRepository } from './repositories/MongoTransactionRepository';
import { TransactionProcessor } from './TransactionProcessor';
import { createMonitoringServer } from './monitoring';

const logger = createLogger({ serviceName: 'transaction-worker', level: env.LOG_LEVEL });

async function bootstrap(): Promise<void> {
  await connectDatabase(logger);

  const rabbitConnection = new RabbitMQConnection({ url: env.RABBITMQ_URL, logger });
  const channel = await rabbitConnection.connect();
  await assertTransactionTopology(channel);

  const transactionRepo = new MongoTransactionRepository();
  const processor = new TransactionProcessor(transactionRepo, logger);

  const consumer = new Consumer(channel, logger);
  await consumer.consume<TransactionCreatedEvent>(TOPOLOGY.transactionEvents.queue, (event) =>
    processor.handle(event),
  );

  logger.info('transaction-worker is running and consuming transaction events');

  const monitoringApp = createMonitoringServer(
    channel,
    () => isDatabaseConnected() && rabbitConnection.isConnected(),
  );
  const server = monitoringApp.listen(env.PORT, () => {
    logger.info(`transaction-worker monitoring endpoint listening on port ${env.PORT}`);
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
  logger.error({ err }, 'Failed to start transaction-worker');
  process.exit(1);
});
