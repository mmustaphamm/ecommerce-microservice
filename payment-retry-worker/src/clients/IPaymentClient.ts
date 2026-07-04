import { InitiatePaymentRequest, InitiatePaymentResponse } from '@ecommerce/shared';

export interface IPaymentClient {
  initiatePayment(request: InitiatePaymentRequest): Promise<InitiatePaymentResponse>;
}
