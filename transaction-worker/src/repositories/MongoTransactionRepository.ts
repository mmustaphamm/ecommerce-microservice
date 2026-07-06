import { ITransactionRepository } from './ITransactionRepository';
import { TransactionModel, TransactionAttributes } from '../models/Transaction';

export class MongoTransactionRepository implements ITransactionRepository {
  async saveIfNotExists(transaction: TransactionAttributes): Promise<void> {
    await TransactionModel.findOneAndUpdate(
      { transactionId: transaction.transactionId },
      { $setOnInsert: transaction },
      { upsert: true },
    );
  }
}
