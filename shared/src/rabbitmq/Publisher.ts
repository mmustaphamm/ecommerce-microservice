import { ConfirmChannel } from 'amqplib';
import type { Logger } from 'pino';


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
