import { TransactionProcessor } from './TransactionProcessor';
import { ITransactionRepository } from './repositories/ITransactionRepository';
import { TransactionCreatedEvent } from '@ecommerce/shared';

describe('TransactionProcessor', () => {
  it('maps the event to the repository shape and saves it', async () => {
    const saveIfNotExists = jest.fn().mockResolvedValue(undefined);
    const repo: ITransactionRepository = { saveIfNotExists };
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;

    const processor = new TransactionProcessor(repo, logger);

    const event: TransactionCreatedEvent = {
      transactionId: 'txn-1',
      customerId: 'cust-0001',
      orderId: 'order-1',
      productId: 'prod-0001',
      amount: 19.99,
      createdAt: '2026-07-03T10:00:00.000Z',
    };

    await processor.handle(event);

    expect(saveIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'txn-1',
        customerId: 'cust-0001',
        orderId: 'order-1',
        productId: 'prod-0001',
        amount: 19.99,
      }),
    );
  });

  it('propagates repository errors so the message is nacked and dead-lettered', async () => {
    const repo: ITransactionRepository = {
      saveIfNotExists: jest.fn().mockRejectedValue(new Error('db down')),
    };
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
    const processor = new TransactionProcessor(repo, logger);

    const event: TransactionCreatedEvent = {
      transactionId: 'txn-2',
      customerId: 'cust-0001',
      orderId: 'order-2',
      productId: 'prod-0001',
      amount: 5,
      createdAt: new Date().toISOString(),
    };

    await expect(processor.handle(event)).rejects.toThrow('db down');
  });
});
