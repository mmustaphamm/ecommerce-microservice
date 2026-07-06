import { Publisher, TransactionCreatedEvent, TOPOLOGY } from '@ecommerce/shared/src';
import { ITransactionEventPublisher } from './ITransactionEventPublisher';

export class RabbitMQTransactionPublisher implements ITransactionEventPublisher {
  constructor(private readonly publisher: Publisher) {}

  async publishTransactionCreated(event: TransactionCreatedEvent, correlationId?: string): Promise<void> {
    const { exchange, routingKey } = TOPOLOGY.transactionEvents;
    await this.publisher.publish(exchange, routingKey, event, correlationId);
  }
}
