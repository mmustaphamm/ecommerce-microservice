import { ConfirmChannel } from 'amqplib';
import type { Logger } from 'pino';

/**
 * Publishes JSON messages to a direct exchange with a given routing key,
 * using RabbitMQ's publisher confirms.
 *
 * Why this matters: the plain `channel.publish()` boolean return value only
 * reflects local write-buffer pressure in the client library - it does NOT
 * mean the broker received or persisted the message. For financial events
 * (payments, transaction history), that distinction is the difference
 * between "we think we sent it" and "the broker has durably accepted it".
 *
 * A `ConfirmChannel` (see RabbitMQConnection) lets us `await` an explicit
 * ack/nack from the broker per message via a callback, which this class
 * wraps in a Promise so callers can simply `await publisher.publish(...)`
 * and know the broker confirmed receipt before proceeding.
 */
export class Publisher {
  constructor(
    private readonly channel: ConfirmChannel,
    private readonly logger: Logger,
  ) {}

  publish(
    exchange: string,
    routingKey: string,
    payload: unknown,
    correlationId?: string,
  ): Promise<boolean> {
    const buffer = Buffer.from(JSON.stringify(payload));

    return new Promise<boolean>((resolve, reject) => {
      this.channel.publish(
        exchange,
        routingKey,
        buffer,
        {
          persistent: true,
          contentType: 'application/json',
          correlationId,
          timestamp: Date.now(),
        },
        (err) => {
          if (err) {
            this.logger.error(
              { exchange, routingKey, err },
              'Broker did not confirm message - publish failed',
            );
            reject(err);
            return;
          }
          this.logger.info(
            { exchange, routingKey, correlationId },
            'Message published and confirmed by broker',
          );
          resolve(true);
        },
      );
    });
  }

  /**
   * Publishes directly to a named queue (bypassing an exchange), used for
   * the payment-retry delay-queue bounce pattern where there's no routing
   * decision to make - we're placing the message straight into a specific
   * holding queue.
   */
  sendToQueue(queue: string, payload: unknown, correlationId?: string): Promise<boolean> {
    const buffer = Buffer.from(JSON.stringify(payload));

    return new Promise<boolean>((resolve, reject) => {
      this.channel.sendToQueue(
        queue,
        buffer,
        { persistent: true, contentType: 'application/json', correlationId, timestamp: Date.now() },
        (err) => {
          if (err) {
            this.logger.error({ queue, err }, 'Broker did not confirm message - send failed');
            reject(err);
            return;
          }
          resolve(true);
        },
      );
    });
  }
}
