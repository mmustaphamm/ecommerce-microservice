import { Schema, model, Document } from 'mongoose';
import { OrderStatus } from '@ecommerce/shared/src';

export interface OrderAttributes {
  orderId: string;
  customerId: string;
  productId: string;
  amount: number;
  orderStatus: OrderStatus;
  /**
   * Tracks whether the synchronous call to Payment Service succeeded. When
   * false, the order was still persisted (per our resilience design) and a
   * `payment.retry.requested` event was published for later reconciliation.
   */
  paymentInitiated: boolean;
  /**
   * Client-supplied idempotency key (from the `Idempotency-Key` header).
   * If a request with the same key arrives again (e.g. a client retry after
   * a network timeout), we return the existing order instead of creating a
   * duplicate. Optional + sparse-indexed since not every caller sends one.
   */
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
