import { Channel } from 'amqplib';

/**
 * Central definition of our RabbitMQ topology so the publisher (Payment
 * Service) and consumer (Transaction Worker) always agree on names -
 * defining this in one shared place prevents drift between the two sides.
 *
 * Topology:
 *   payment.events (direct exchange)
 *     -> routing key "transaction.created" -> transaction-history-queue
 *          -> on repeated processing failure, dead-lettered to:
 *     -> transaction-history-dlq (bound to payment.events.dlx)
 *
 *   payment.retry (direct exchange)
 *     -> routing key "payment.retry.requested" -> payment-retry-queue
 *        (consumed by payment-retry-worker, which retries POST /payments)
 *
 *        On a failed retry attempt (with attempts remaining), the worker
 *        republishes the message to payment-retry-delay-queue, which holds
 *        it for a fixed TTL and then dead-letters it BACK into payment.retry
 *        - this is the standard "TTL + DLX bounce" pattern for delayed
 *        retries in RabbitMQ, since core RabbitMQ has no native delay/
 *        schedule feature without a plugin.
 *
 *        Once attempts are exhausted, the worker nacks without requeue,
 *        routing the message to payment-retry-dlq (terminal - a human or
 *        an alerting system needs to look at these).
 */
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

/**
 * Idempotently asserts the transaction-events exchange/queue/DLQ topology.
 * Safe to call from both the publisher and the consumer on startup.
 */
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

  // Delay "holding" queue: no consumer ever reads from this directly. Each
  // message sits here for `delayMs` (per-queue TTL) and is then automatically
  // dead-lettered by RabbitMQ back into the main exchange/routing key,
  // effectively implementing "retry after N seconds" with core RabbitMQ.
  await channel.assertQueue(r.delayQueue, {
    durable: true,
    messageTtl: r.delayMs,
    deadLetterExchange: r.exchange,
    deadLetterRoutingKey: r.routingKey,
  });
}
