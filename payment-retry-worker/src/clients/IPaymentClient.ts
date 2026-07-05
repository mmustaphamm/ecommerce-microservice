import { InitiatePaymentRequest, InitiatePaymentResponse } from '@ecommerce/shared/src';

export interface IPaymentClient {
  initiatePayment(request: InitiatePaymentRequest): Promise<InitiatePaymentResponse>;
}
