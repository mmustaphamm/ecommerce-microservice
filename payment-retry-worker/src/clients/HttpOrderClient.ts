import { HttpClient, UpdateOrderPaymentStatusRequest } from '@ecommerce/shared';
import { IOrderClient } from './IOrderClient';

export class HttpOrderClient implements IOrderClient {
  constructor(private readonly httpClient: HttpClient) {}

  async updatePaymentStatus(orderId: string, update: UpdateOrderPaymentStatusRequest): Promise<void> {
    await this.httpClient.patch(`/orders/${orderId}/payment-status`, update);
  }
}
