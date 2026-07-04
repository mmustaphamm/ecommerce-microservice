import { Schema, model, Document } from 'mongoose';

export interface TransactionAttributes {
  transactionId: string;
  customerId: string;
  orderId: string;
  productId: string;
  amount: number;
  createdAt: Date;
}

export interface TransactionDocument extends TransactionAttributes, Document {}

const transactionSchema = new Schema<TransactionDocument>({
  transactionId: { type: String, required: true, unique: true, index: true },
  customerId: { type: String, required: true, index: true },
  orderId: { type: String, required: true, index: true },
  productId: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  createdAt: { type: Date, required: true },
});

export const TransactionModel = model<TransactionDocument>('Transaction', transactionSchema);
