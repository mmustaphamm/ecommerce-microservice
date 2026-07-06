import { Schema, model, Document } from 'mongoose';
import { OrderStatus } from '@ecommerce/shared/src';

export interface OrderAttributes {
  orderId: string;
  customerId: string;
  productId: string;
  amount: number;
  orderStatus: OrderStatus;
  paymentInitiated: boolean;
  idempotencyKey?: string;
  createdAt: Date;
}

export interface OrderDocument extends OrderAttributes, Document {}

const orderSchema = new Schema<OrderDocument>({
  orderId: { type: String, required: true, unique: true, index: true },
  customerId: { type: String, required: true, index: true },
  productId: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  orderStatus: {
    type: String,
    enum: ['pending', 'stock_reserved', 'payment_pending', 'confirmed', 'failed'],
    default: 'pending',
    required: true,
  },
  paymentInitiated: { type: Boolean, required: true, default: false },
  idempotencyKey: { type: String, required: false, unique: true, sparse: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

export const OrderModel = model<OrderDocument>('Order', orderSchema);
