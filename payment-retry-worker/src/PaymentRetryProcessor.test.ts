import { PaymentRetryProcessor } from './PaymentRetryProcessor';
import { IPaymentClient } from './clients/IPaymentClient';
import { IOrderClient } from './clients/IOrderClient';
import { UpstreamServiceError, Publisher, PaymentRetryRequestedEvent, TOPOLOGY } from '@ecommerce/shared/src';

const baseEvent: PaymentRetryRequestedEvent = {
  orderId: 'order-1',
  customerId: 'cust-0001',
  productId: 'prod-0001',
  amount: 19.99,
  requestedAt: new Date().toISOString(),
  attempts: 1,
};

function makeProcessor(paymentClient: IPaymentClient, orderClient: IOrderClient, publisher: Publisher) {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
  return new PaymentRetryProcessor(paymentClient, orderClient, publisher, logger);
}

describe('PaymentRetryProcessor', () => {
  it('marks the order confirmed when the retried payment succeeds', async () => {
    const paymentClient: IPaymentClient = {
      initiatePayment: jest.fn().mockResolvedValue({ paymentId: 'p1', orderId: 'order-1', status: 'accepted' }),
    };
    const orderClient: IOrderClient = { updatePaymentStatus: jest.fn().mockResolvedValue(undefined) };
    const publisher = { sendToQueue: jest.fn() } as unknown as Publisher;

    const processor = makeProcessor(paymentClient, orderClient, publisher);
    await processor.handle(baseEvent);

    expect(orderClient.updatePaymentStatus).toHaveBeenCalledWith('order-1', {
      paymentInitiated: true,
      orderStatus: 'confirmed',
    });
    expect(publisher.sendToQueue).not.toHaveBeenCalled();
  });

  it('reschedules to the delay queue with an incremented attempt count when attempts remain', async () => {
    const paymentClient: IPaymentClient = {
      initiatePayment: jest.fn().mockRejectedValue(new UpstreamServiceError('payment-service', 'down')),
    };
    const orderClient: IOrderClient = { updatePaymentStatus: jest.fn() };
    const publisher = { sendToQueue: jest.fn().mockResolvedValue(true) } as unknown as Publisher;

    const processor = makeProcessor(paymentClient, orderClient, publisher);
    await processor.handle({ ...baseEvent, attempts: 1 });

    expect(publisher.sendToQueue).toHaveBeenCalledWith(
      TOPOLOGY.paymentRetry.delayQueue,
      expect.objectContaining({ orderId: 'order-1', attempts: 2 }),
    );
    // Order state is untouched while retries remain - still payment_pending.
    expect(orderClient.updatePaymentStatus).not.toHaveBeenCalled();
  });

  it('marks the order permanently failed and rethrows once attempts are exhausted', async () => {
    const paymentClient: IPaymentClient = {
      initiatePayment: jest.fn().mockRejectedValue(new UpstreamServiceError('payment-service', 'down')),
    };
    const orderClient: IOrderClient = { updatePaymentStatus: jest.fn().mockResolvedValue(undefined) };
    const publisher = { sendToQueue: jest.fn() } as unknown as Publisher;

    const processor = makeProcessor(paymentClient, orderClient, publisher);

    await expect(
      processor.handle({ ...baseEvent, attempts: TOPOLOGY.paymentRetry.maxAttempts }),
    ).rejects.toThrow();

    expect(orderClient.updatePaymentStatus).toHaveBeenCalledWith('order-1', {
      paymentInitiated: false,
      orderStatus: 'failed',
    });
    // No further retry scheduled - attempts were exhausted.
    expect(publisher.sendToQueue).not.toHaveBeenCalled();
  });

  it('propagates unexpected (non-upstream) errors without touching order state', async () => {
    const paymentClient: IPaymentClient = {
      initiatePayment: jest.fn().mockRejectedValue(new Error('totally unexpected bug')),
    };
    const orderClient: IOrderClient = { updatePaymentStatus: jest.fn() };
    const publisher = { sendToQueue: jest.fn() } as unknown as Publisher;

    const processor = makeProcessor(paymentClient, orderClient, publisher);

    await expect(processor.handle(baseEvent)).rejects.toThrow('totally unexpected bug');
    expect(orderClient.updatePaymentStatus).not.toHaveBeenCalled();
  });
});
