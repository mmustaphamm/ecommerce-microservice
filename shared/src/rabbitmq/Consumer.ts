import { Channel, ConsumeMessage } from 'amqplib';
import type { Logger } from 'pino';

export type MessageHandler<T> = (payload: T, raw: ConsumeMessage) => Promise<void>;

/**
 * Consumes messages from a queue with manual acknowledgment.
 *
 * On handler success -> ack (message removed from queue).
 * On handler failure -> nack WITHOUT requeue, which routes the message to
 * the queue's configured dead-letter-exchange (see topology.ts). This is
 * what gives us a working DLQ: we don't need retry-count bookkeeping here
 * because a single failure is enough to dead-letter, keeping the demo
 * simple while still demonstrating the pattern end-to-end.
 */
export class Consumer {
  constructor(
    private readonly channel: Channel,
    private readonly logger: Logger,
  ) {}

  async consume<T>(queue: string, handler: MessageHandler<T>): Promise<void> {
    await this.channel.prefetch(1);

    await this.channel.consume(queue, (msg) => {
      if (!msg) return;

      void this.handleMessage(msg, handler);
    });

    this.logger.info({ queue }, 'Consumer subscribed');
  }

  private async handleMessage<T>(msg: ConsumeMessage, handler: MessageHandler<T>): Promise<void> {
    try {
      const payload = JSON.parse(msg.content.toString()) as T;
      await handler(payload, msg);
      this.channel.ack(msg);
    } catch (err) {
      this.logger.error({ err }, 'Message processing failed - routing to DLQ');
      this.channel.nack(msg, false, false);
    }
  }
}
