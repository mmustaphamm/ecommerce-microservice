import { InitiatePaymentRequest, InitiatePaymentResponse } from '@ecommerce/shared';

/**
 * Abstraction over calling the Payment Service. Kept as an interface so
 * OrderService can be unit tested with a fake client (simulating success,
 * failure, or timeouts) without any real HTTP call or running Payment Service.
 */
export interface IPaymentClient {
  initiatePayment(
    request: InitiatePaymentRequest,
    correlationId?: string,
  ): Promise<InitiatePaymentResponse>;
}
