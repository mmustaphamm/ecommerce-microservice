import { TransactionAttributes } from '../models/Transaction';

export interface ITransactionRepository {
  saveIfNotExists(transaction: TransactionAttributes): Promise<void>;
}
