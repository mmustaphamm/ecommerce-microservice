import { HttpClient, InitiatePaymentRequest, InitiatePaymentResponse, ApiSuccessResponse } from '@ecommerce/shared/src';
import { IPaymentClient } from './IPaymentClient';

/**
 * Real implementation of `IPaymentClient`, backed by the shared `HttpClient`
 * (which already applies retry-with-backoff for transient failures and
 * throws `UpstreamServiceError` if Payment Service is unreachable after
 * exhausting retries - see OrderService for how that failure is handled).
 */
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
