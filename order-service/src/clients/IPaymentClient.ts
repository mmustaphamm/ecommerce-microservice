import { InitiatePaymentRequest, InitiatePaymentResponse } from '@ecommerce/shared/src';

export interface IPaymentClient {
  initiatePayment(
    request: InitiatePaymentRequest,
    correlationId?: string,
  ): Promise<InitiatePaymentResponse>;
}
