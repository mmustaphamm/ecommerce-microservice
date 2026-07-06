import { Channel } from 'amqplib';

export const TOPOLOGY = {
  transactionEvents: {
    exchange: 'payment.events',
    exchangeType: 'direct' as const,
    routingKey: 'transaction.created',
    queue: 'transaction-history-queue',
    deadLetterExchange: 'payment.events.dlx',
    deadLetterQueue: 'transaction-history-dlq',
    deadLetterRoutingKey: 'transaction.created.dead',
  },
  paymentRetry: {
    exchange: 'payment.retry',
    exchangeType: 'direct' as const,
    routingKey: 'payment.retry.requested',
    queue: 'payment-retry-queue',
    delayQueue: 'payment-retry-delay-queue',
    delayMs: 5000,
    deadLetterExchange: 'payment.retry.dlx',
    deadLetterQueue: 'payment-retry-dlq',
    deadLetterRoutingKey: 'payment.retry.dead',
    maxAttempts: 3,
  },
} as const;

export async function assertTransactionTopology(channel: Channel): Promise<void> {
  const t = TOPOLOGY.transactionEvents;

  // Dead-letter exchange + queue: where messages land after exceeding retry attempts.
  await channel.assertExchange(t.deadLetterExchange, 'direct', { durable: true });
  await channel.assertQueue(t.deadLetterQueue, { durable: true });
  await channel.bindQueue(t.deadLetterQueue, t.deadLetterExchange, t.deadLetterRoutingKey);

  // Main exchange + queue, configured to dead-letter on rejection/nack.
  await channel.assertExchange(t.exchange, t.exchangeType, { durable: true });
  await channel.assertQueue(t.queue, {
    durable: true,
    deadLetterExchange: t.deadLetterExchange,
    deadLetterRoutingKey: t.deadLetterRoutingKey,
  });
  await channel.bindQueue(t.queue, t.exchange, t.routingKey);
}

export async function assertPaymentRetryTopology(channel: Channel): Promise<void> {
  const r = TOPOLOGY.paymentRetry;

  // Terminal DLQ - where a message lands after exhausting maxAttempts.
  await channel.assertExchange(r.deadLetterExchange, 'direct', { durable: true });
  await channel.assertQueue(r.deadLetterQueue, { durable: true });
  await channel.bindQueue(r.deadLetterQueue, r.deadLetterExchange, r.deadLetterRoutingKey);

  // Main exchange + queue that the worker consumes from.
  await channel.assertExchange(r.exchange, r.exchangeType, { durable: true });
  await channel.assertQueue(r.queue, { durable: true });
  await channel.bindQueue(r.queue, r.exchange, r.routingKey);

  await channel.assertQueue(r.delayQueue, {
    durable: true,
    messageTtl: r.delayMs,
    deadLetterExchange: r.exchange,
    deadLetterRoutingKey: r.routingKey,
  });
}
