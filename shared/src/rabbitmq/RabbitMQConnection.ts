import amqp, { ConfirmChannel, ChannelModel } from 'amqplib';
import type { Logger } from 'pino';

export interface RabbitMQConnectionOptions {
  url: string;
  logger: Logger;
  reconnectDelayMs?: number;
  connectMaxAttempts?: number;
}

export class RabbitMQConnection {
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private readonly url: string;
  private readonly logger: Logger;
  private readonly reconnectDelayMs: number;
  private readonly connectMaxAttempts: number;
  private isClosingIntentionally = false;
  private connected = false;

  constructor(options: RabbitMQConnectionOptions) {
    this.url = options.url;
    this.logger = options.logger;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 3000;
    this.connectMaxAttempts = options.connectMaxAttempts ?? 10;
  }

  async connect(): Promise<ConfirmChannel> {
    for (let attempt = 1; attempt <= this.connectMaxAttempts; attempt += 1) {
      try {
        return await this.connectOnce();
      } catch (err) {
        this.connected = false;
        await this.closePartialConnection();

        if (attempt === this.connectMaxAttempts || this.isClosingIntentionally) {
          throw err;
        }

        this.logger.warn(
          { err, attempt, nextAttemptInMs: this.reconnectDelayMs },
          'RabbitMQ connection attempt failed, retrying...',
        );
        await delay(this.reconnectDelayMs);
      }
    }

    throw new Error('RabbitMQ connection failed');
  }

  private async connectOnce(): Promise<ConfirmChannel> {
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

  private async closePartialConnection(): Promise<void> {
    const wasClosingIntentionally = this.isClosingIntentionally;
    this.isClosingIntentionally = true;
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
    this.isClosingIntentionally = wasClosingIntentionally;
    this.channel = null;
    this.connection = null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
