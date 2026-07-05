import { TransactionCreatedEvent } from '@ecommerce/shared/src';

/**
 * Abstraction over "publish a transaction event somewhere". PaymentService
 * depends on this interface rather than the RabbitMQ Publisher directly -
 * this is what makes it possible to unit test the payment flow with a fake
 * publisher and no real broker connection, and would let us swap the
 * transport (e.g. Kafka) later without touching business logic.
 */
export interface ITransactionEventPublisher {
  publishTransactionCreated(event: TransactionCreatedEvent, correlationId?: string): Promise<void>;
}
