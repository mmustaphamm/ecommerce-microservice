import { UpdateOrderPaymentStatusRequest } from '@ecommerce/shared/src';

export interface IOrderClient {
  updatePaymentStatus(orderId: string, update: UpdateOrderPaymentStatusRequest): Promise<void>;
}
