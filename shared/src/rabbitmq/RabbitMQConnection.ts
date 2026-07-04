import amqp, { ConfirmChannel, ChannelModel } from 'amqplib';
import type { Logger } from 'pino';

export interface RabbitMQConnectionOptions {
  url: string;
  logger: Logger;
  reconnectDelayMs?: number;
}

/**
 * Owns a single amqplib connection + channel, with basic auto-reconnect.
 *
 * Both the Payment Service (publisher) and Transaction Worker (consumer)
 * depend on this rather than talking to amqplib directly, so connection
 * lifecycle/reconnect logic is written once instead of duplicated.
 */
export class RabbitMQConnection {
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private readonly url: string;
  private readonly logger: Logger;
  private readonly reconnectDelayMs: number;
  private isClosingIntentionally = false;
  private connected = false;

  constructor(options: RabbitMQConnectionOptions) {
    this.url = options.url;
    this.logger = options.logger;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 3000;
  }

  async connect(): Promise<ConfirmChannel> {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createConfirmChannel();

    this.connection.on('error', (err) => {
      this.connected = false;
      this.logger.error({ err }, 'RabbitMQ connection error');
    });

    this.connection.on('close', () => {
      this.connected = false;
      if (!this.isClosingIntentionally) {
        this.logger.warn('RabbitMQ connection closed unexpectedly, reconnecting...');
        setTimeout(() => this.connect().catch((err) => this.logger.error({ err }, 'Reconnect failed')), this.reconnectDelayMs);
      }
    });

    this.connected = true;
    this.logger.info('Connected to RabbitMQ');
    return this.channel;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getChannel(): ConfirmChannel {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized - call connect() first');
    }
    return this.channel;
  }

  async close(): Promise<void> {
    this.isClosingIntentionally = true;
    await this.channel?.close();
    await this.connection?.close();
  }
}
