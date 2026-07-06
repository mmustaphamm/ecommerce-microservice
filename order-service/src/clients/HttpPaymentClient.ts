import { HttpClient, InitiatePaymentRequest, InitiatePaymentResponse, ApiSuccessResponse } from '@ecommerce/shared/src';
import { IPaymentClient } from './IPaymentClient';

export class HttpPaymentClient implements IPaymentClient {
  constructor(private readonly httpClient: HttpClient) {}

  async initiatePayment(
    request: InitiatePaymentRequest,
    correlationId?: string,
  ): Promise<InitiatePaymentResponse> {
    const response = await this.httpClient.post<ApiSuccessResponse<InitiatePaymentResponse>>(
      '/payments',
      request,
      correlationId,
    );
    return response.data;
  }
}
