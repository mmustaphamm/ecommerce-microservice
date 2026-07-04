import { TransactionAttributes } from '../models/Transaction';

export interface ITransactionRepository {
  /**
   * Idempotent save: if a message is redelivered (e.g. consumer crashed
   * after processing but before ack), inserting the same transactionId
   * again must not create a duplicate record or throw.
   */
  saveIfNotExists(transaction: TransactionAttributes): Promise<void>;
}
