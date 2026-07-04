import { randomUUID } from 'crypto';
import { InitiatePaymentRequest, InitiatePaymentResponse, TransactionCreatedEvent } from '@ecommerce/shared';
import { ITransactionEventPublisher } from '../rabbitmq/ITransactionEventPublisher';

/**
 * Deliberately minimal, per the exercise spec: this is NOT a real payment
 * processor. It simulates "always accepted" payment processing and publishes
 * a transaction event for the worker to persist. A real implementation would
 * integrate a payment gateway (Stripe, etc.) here - that integration point
 * is isolated to this one class, so swapping it out later wouldn't touch
 * controllers, routes, or the publishing mechanism.
 */
export class PaymentService {
  constructor(private readonly eventPublisher: ITransactionEventPublisher) {}

  async processPayment(
    request: InitiatePaymentRequest,
    correlationId?: string,
  ): Promise<InitiatePaymentResponse> {
    const paymentId = randomUUID();

    const event: TransactionCreatedEvent = {
      transactionId: paymentId,
      customerId: request.customerId,
      orderId: request.orderId,
      productId: request.productId,
      amount: request.amount,
      createdAt: new Date().toISOString(),
    };

    // Awaited deliberately: if the broker doesn't confirm durable receipt
    // of the transaction event, we must not report "accepted" back to
    // Order Service - that would create a payment with no corresponding
    // transaction history record. Letting this throw surfaces as a 500 to
    // Order Service, which correctly treats it as retryable/upstream-down
    // rather than a successful payment.
    await this.eventPublisher.publishTransactionCreated(event, correlationId);

    return {
      paymentId,
      orderId: request.orderId,
      status: 'accepted',
    };
  }
}
