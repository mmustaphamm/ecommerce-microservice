import { PaymentService } from './PaymentService';
import { ITransactionEventPublisher } from '../rabbitmq/ITransactionEventPublisher';
import { InitiatePaymentRequest, TransactionCreatedEvent } from '@ecommerce/shared/src';

class FakeTransactionEventPublisher implements ITransactionEventPublisher {
  public publishedEvents: TransactionCreatedEvent[] = [];
  public shouldFail = false;

  async publishTransactionCreated(event: TransactionCreatedEvent): Promise<void> {
    if (this.shouldFail) {
      throw new Error('broker did not confirm');
    }
    this.publishedEvents.push(event);
  }
}

describe('PaymentService', () => {
  let publisher: FakeTransactionEventPublisher;
  let service: PaymentService;

  const request: InitiatePaymentRequest = {
    customerId: 'cust-0001',
    orderId: 'order-0001',
    productId: 'prod-0001',
    amount: 19.99,
  };

  beforeEach(() => {
    publisher = new FakeTransactionEventPublisher();
    service = new PaymentService(publisher);
  });

  it('returns an accepted payment response', async () => {
    const result = await service.processPayment(request);

    expect(result.status).toBe('accepted');
    expect(result.orderId).toBe('order-0001');
    expect(result.paymentId).toBeDefined();
  });

  it('publishes a transaction created event with the correct data', async () => {
    await service.processPayment(request);

    expect(publisher.publishedEvents).toHaveLength(1);
    expect(publisher.publishedEvents[0]).toMatchObject({
      customerId: 'cust-0001',
      orderId: 'order-0001',
      productId: 'prod-0001',
      amount: 19.99,
    });
  });

  it('does NOT report success if the broker fails to confirm the transaction event', async () => {
    publisher.shouldFail = true;

    // This is the fix for "payment publishing is not fully guaranteed":
    // if we can't durably record the transaction, we must not tell Order
    // Service the payment was accepted.
    await expect(service.processPayment(request)).rejects.toThrow('broker did not confirm');
  });
});
