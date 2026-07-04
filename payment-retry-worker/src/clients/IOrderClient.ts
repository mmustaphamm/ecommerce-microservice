import { UpdateOrderPaymentStatusRequest } from '@ecommerce/shared';

export interface IOrderClient {
  updatePaymentStatus(orderId: string, update: UpdateOrderPaymentStatusRequest): Promise<void>;
}
