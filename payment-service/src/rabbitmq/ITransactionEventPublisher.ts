import { TransactionCreatedEvent } from '@ecommerce/shared/src';

export interface ITransactionEventPublisher {
  publishTransactionCreated(event: TransactionCreatedEvent, correlationId?: string): Promise<void>;
}
