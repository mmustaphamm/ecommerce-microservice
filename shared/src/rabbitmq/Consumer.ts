import { Channel, ConsumeMessage } from 'amqplib';
import type { Logger } from 'pino';

export type MessageHandler<T> = (payload: T, raw: ConsumeMessage) => Promise<void>;

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
