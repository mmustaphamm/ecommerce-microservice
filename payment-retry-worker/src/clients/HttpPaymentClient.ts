import { HttpClient, ApiSuccessResponse, InitiatePaymentRequest, InitiatePaymentResponse } from '@ecommerce/shared/src';
import { IPaymentClient } from './IPaymentClient';

export class HttpPaymentClient implements IPaymentClient {
  constructor(private readonly httpClient: HttpClient) {}

  async initiatePayment(request: InitiatePaymentRequest): Promise<InitiatePaymentResponse> {
    const response = await this.httpClient.post<ApiSuccessResponse<InitiatePaymentResponse>>(
      '/payments',
      request,
    );
    return response.data;
  }
}
