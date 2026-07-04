import { ITransactionRepository } from './ITransactionRepository';
import { TransactionModel, TransactionAttributes } from '../models/Transaction';

export class MongoTransactionRepository implements ITransactionRepository {
  async saveIfNotExists(transaction: TransactionAttributes): Promise<void> {
    // Upsert on transactionId makes this safe against RabbitMQ's
    // at-least-once delivery guarantee - a redelivered message after a
    // crash-before-ack will not create a duplicate history record.
    await TransactionModel.findOneAndUpdate(
      { transactionId: transaction.transactionId },
      { $setOnInsert: transaction },
      { upsert: true },
    );
  }
}
