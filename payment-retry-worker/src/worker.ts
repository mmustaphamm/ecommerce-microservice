import {
  createLogger,
  RabbitMQConnection,
  Consumer,
  Publisher,
  HttpClient,
  assertPaymentRetryTopology,
  registerGracefulShutdown,
  TOPOLOGY,
  PaymentRetryRequestedEvent,
} from '@ecommerce/shared/src';
import { env } from './config/env';
import { HttpPaymentClient } from './clients/HttpPaymentClient';
import { HttpOrderClient } from './clients/HttpOrderClient';
import { PaymentRetryProcessor } from './PaymentRetryProcessor';
import { createMonitoringServer } from './monitoring';

const logger = createLogger({ serviceName: 'payment-retry-worker', level: env.LOG_LEVEL });

async function bootstrap(): Promise<void> {
  const rabbitConnection = new RabbitMQConnection({ url: env.RABBITMQ_URL, logger });
  const channel = await rabbitConnection.connect();
  await assertPaymentRetryTopology(channel);

  const publisher = new Publisher(channel, logger);

  const paymentHttpClient = new HttpClient({
    baseURL: env.PAYMENT_SERVICE_URL,
    serviceName: 'payment-service',
    logger,
    internalApiKey: env.INTERNAL_API_KEY,
  });
  const orderHttpClient = new HttpClient({
    baseURL: env.ORDER_SERVICE_URL,
    serviceName: 'order-service',
    logger,
    internalApiKey: env.INTERNAL_API_KEY,
  });

  const paymentClient = new HttpPaymentClient(paymentHttpClient);
  const orderClient = new HttpOrderClient(orderHttpClient);
  const processor = new PaymentRetryProcessor(paymentClient, orderClient, publisher, logger);

  const consumer = new Consumer(channel, logger);
  await consumer.consume<PaymentRetryRequestedEvent>(TOPOLOGY.paymentRetry.queue, (event) =>
    processor.handle(event),
  );

  logger.info('payment-retry-worker is running and consuming payment retry events');

  const monitoringApp = createMonitoringServer(channel, () => rabbitConnection.isConnected());
  const server = monitoringApp.listen(env.PORT, () => {
    logger.info(`payment-retry-worker monitoring endpoint listening on port ${env.PORT}`);
  });

  registerGracefulShutdown({
    httpServer: server,
    logger,
    onShutdown: async () => {
      await rabbitConnection.close();
    },
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start payment-retry-worker');
  process.exit(1);
});
