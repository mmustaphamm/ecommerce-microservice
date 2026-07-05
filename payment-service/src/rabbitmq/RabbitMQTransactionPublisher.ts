import { Publisher, TransactionCreatedEvent, TOPOLOGY } from '@ecommerce/shared/src';
import { ITransactionEventPublisher } from './ITransactionEventPublisher';

export class RabbitMQTransactionPublisher implements ITransactionEventPublisher {
  constructor(private readonly publisher: Publisher) {}

  async publishTransactionCreated(event: TransactionCreatedEvent, correlationId?: string): Promise<void> {
    const { exchange, routingKey } = TOPOLOGY.transactionEvents;
    // Awaited so the caller (PaymentService) knows the broker has durably
    // confirmed receipt before responding "accepted" to Order Service -
    // otherwise we could tell Order Service payment succeeded while the
    // transaction event silently never reached the broker.
    await this.publisher.publish(exchange, routingKey, event, correlationId);
  }
}
