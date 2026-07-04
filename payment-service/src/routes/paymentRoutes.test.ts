import request from 'supertest';
import { createLogger } from '@ecommerce/shared';
import { createApp } from '../app';
import { ITransactionEventPublisher } from '../rabbitmq/ITransactionEventPublisher';
import { TransactionCreatedEvent } from '@ecommerce/shared';

class FakeTransactionEventPublisher implements ITransactionEventPublisher {
  public publishedEvents: TransactionCreatedEvent[] = [];

  async publishTransactionCreated(event: TransactionCreatedEvent): Promise<void> {
    this.publishedEvents.push(event);
  }
}

describe('POST /payments', () => {
  let publisher: FakeTransactionEventPublisher;
  const internalApiKey = process.env.INTERNAL_API_KEY as string;

  beforeEach(() => {
    publisher = new FakeTransactionEventPublisher();
  });

  const buildApp = () =>
    createApp(createLogger({ serviceName: 'payment-service:test' }), publisher, () => true);

  it('returns 403 without the internal API key', async () => {
    const response = await request(buildApp()).post('/payments').send({
      customerId: 'cust-0001',
      orderId: 'order-0001',
      productId: 'prod-0001',
      amount: 19.99,
    });

    expect(response.status).toBe(403);
  });

  it('returns 201 with an accepted payment when internal auth is valid', async () => {
    const response = await request(buildApp())
      .post('/payments')
      .set('x-internal-api-key', internalApiKey)
      .send({
        customerId: 'cust-0001',
        orderId: 'order-0001',
        productId: 'prod-0001',
        amount: 19.99,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('accepted');
    expect(publisher.publishedEvents).toHaveLength(1);
  });

  it('returns 400 when required fields are missing', async () => {
    const response = await request(buildApp())
      .post('/payments')
      .set('x-internal-api-key', internalApiKey)
      .send({ customerId: 'cust-0001' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(publisher.publishedEvents).toHaveLength(0);
  });

  it('returns 200 on health check', async () => {
    const response = await request(buildApp()).get('/health');
    expect(response.status).toBe(200);
  });
});
