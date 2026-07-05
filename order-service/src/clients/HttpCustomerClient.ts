import { HttpClient, ApiSuccessResponse } from '@ecommerce/shared/src';
import { ICustomerClient, CustomerInfo } from './ICustomerClient';

export class HttpCustomerClient implements ICustomerClient {
  constructor(private readonly httpClient: HttpClient) {}

  async getCustomer(customerId: string, correlationId?: string): Promise<CustomerInfo> {
    const response = await this.httpClient.get<ApiSuccessResponse<CustomerInfo>>(
      `/customers/${customerId}`,
      correlationId,
    );
    return response.data;
  }
}
