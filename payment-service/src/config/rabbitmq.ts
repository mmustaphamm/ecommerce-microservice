import type { Logger } from 'pino';
import {
  RabbitMQConnection,
  Publisher,
  assertTransactionTopology,
  assertPaymentRetryTopology,
} from '@ecommerce/shared';
import { env } from './env';

let connection: RabbitMQConnection | null = null;
let publisher: Publisher | null = null;

/**
 * Establishes the RabbitMQ connection and asserts the topology this service
 * publishes to. Asserting here (not just on the consumer side) means the
 * service works correctly even if it's the first one to start up - the
 * exchange/queue/DLQ chain will exist before the first message is published.
 */
export async function connectRabbitMQ(logger: Logger): Promise<void> {
  connection = new RabbitMQConnection({ url: env.RABBITMQ_URL, logger });
  const channel = await connection.connect();

  await assertTransactionTopology(channel);
  await assertPaymentRetryTopology(channel);

  publisher = new Publisher(channel, logger);
}

export function getPublisher(): Publisher {
  if (!publisher) {
    throw new Error('RabbitMQ publisher not initialized - call connectRabbitMQ() first');
  }
  return publisher;
}

export function isRabbitMQReady(): boolean {
  return connection?.isConnected() ?? false;
}

export async function closeRabbitMQ(): Promise<void> {
  await connection?.close();
}
