import { OrderAttributes } from '../models/Order';
import { OrderStatus } from '@ecommerce/shared';

export interface IOrderRepository {
  create(order: OrderAttributes): Promise<OrderAttributes>;
  findByOrderId(orderId: string): Promise<OrderAttributes | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<OrderAttributes | null>;
  updatePaymentStatus(
    orderId: string,
    update: { paymentInitiated: boolean; orderStatus: OrderStatus },
  ): Promise<OrderAttributes | null>;
}
