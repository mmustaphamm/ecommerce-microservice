import type { Logger } from 'pino';
import { TransactionCreatedEvent } from '@ecommerce/shared';
import { ITransactionRepository } from './repositories/ITransactionRepository';

/**
 * Handles a single `TransactionCreatedEvent`. Kept separate from the
 * RabbitMQ `Consumer` wiring (see worker.ts) so this logic can be unit
 * tested with a fake repository and a plain in-memory event object - no
 * broker connection needed.
 */
export class TransactionProcessor {
  constructor(
    private readonly transactionRepo: ITransactionRepository,
    private readonly logger: Logger,
  ) {}

  async handle(event: TransactionCreatedEvent): Promise<void> {
    await this.transactionRepo.saveIfNotExists({
      transactionId: event.transactionId,
      customerId: event.customerId,
      orderId: event.orderId,
      productId: event.productId,
      amount: event.amount,
      createdAt: new Date(event.createdAt),
    });

    this.logger.info(
      { transactionId: event.transactionId, orderId: event.orderId },
      'Transaction persisted to history',
    );
  }
}
