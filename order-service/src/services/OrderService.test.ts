import { OrderService } from './OrderService';
import { IOrderRepository } from '../repositories/IOrderRepository';
import { IPaymentClient } from '../clients/IPaymentClient';
import { IProductClient, ProductInfo } from '../clients/IProductClient';
import { ICustomerClient, CustomerInfo } from '../clients/ICustomerClient';
import { OrderAttributes } from '../models/Order';
import {
  UpstreamServiceError,
  ConflictError,
  Publisher,
  InitiatePaymentResponse,
  OrderStatus,
} from '@ecommerce/shared';

/**
 * Fake repository that mimics the real Mongo implementation closely enough
 * to test idempotency and the save-then-update flow: a unique index on
 * idempotencyKey (rejecting a second insert with the same key, mirroring
 * MongoDB's E11000 duplicate-key error) and a separate updatePaymentStatus
 * step distinct from create.
 */
class FakeOrderRepository implements IOrderRepository {
  public saved: OrderAttributes[] = [];

  async create(order: OrderAttributes): Promise<OrderAttributes> {
    if (order.idempotencyKey && this.saved.some((o) => o.idempotencyKey === order.idempotencyKey)) {
      const duplicateKeyError = new Error('E11000 duplicate key error') as Error & { code: number };
      duplicateKeyError.code = 11000;
      throw duplicateKeyError;
    }
    this.saved.push(order);
    return order;
  }

  async findByOrderId(orderId: string): Promise<OrderAttributes | null> {
    return this.saved.find((o) => o.orderId === orderId) ?? null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<OrderAttributes | null> {
    return this.saved.find((o) => o.idempotencyKey === idempotencyKey) ?? null;
  }

  async updatePaymentStatus(
    orderId: string,
    update: { paymentInitiated: boolean; orderStatus: OrderStatus },
  ): Promise<OrderAttributes | null> {
    const order = this.saved.find((o) => o.orderId === orderId);
    if (!order) return null;
    Object.assign(order, update);
    return order;
  }
}

const fakeCustomer: CustomerInfo = {
  customerId: 'cust-0001',
  name: 'John Doe',
  email: 'john.doe@example.com',
};

const fakeProduct: ProductInfo = {
  productId: 'prod-0001',
  name: 'Wireless Mouse',
  price: 19.99,
  stock: 10,
};

function makeService(
  paymentClient: IPaymentClient,
  publisher: Publisher,
  productOverrides: Partial<IProductClient> = {},
) {
  const orderRepo = new FakeOrderRepository();
  const productClient: IProductClient = {
    getProduct: jest.fn().mockResolvedValue(fakeProduct),
    reserveStock: jest.fn().mockResolvedValue(undefined),
    releaseStock: jest.fn().mockResolvedValue(undefined),
    ...productOverrides,
  };
  const customerClient: ICustomerClient = {
    getCustomer: jest.fn().mockResolvedValue(fakeCustomer),
  };
  const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn() } as any;

  const service = new OrderService(
    orderRepo,
    paymentClient,
    productClient,
    customerClient,
    publisher,
    logger,
  );

  return { service, orderRepo, productClient, customerClient };
}

describe('OrderService', () => {
  it('creates an order with paymentInitiated=true and orderStatus=confirmed when payment succeeds', async () => {
    const paymentResponse: InitiatePaymentResponse = {
      paymentId: 'pay-1',
      orderId: 'will-be-overwritten',
      status: 'accepted',
    };
    const paymentClient: IPaymentClient = {
      initiatePayment: jest.fn().mockResolvedValue(paymentResponse),
    };
    const publisher = { publish: jest.fn() } as unknown as Publisher;

    const { service, orderRepo, productClient } = makeService(paymentClient, publisher);

    const result = await service.createOrder({
      customerId: 'cust-0001',
      productId: 'prod-0001',
      amount: 19.99,
    });

    expect(result.orderStatus).toBe('confirmed');
    expect(orderRepo.saved[0].paymentInitiated).toBe(true);
    expect(productClient.reserveStock).toHaveBeenCalledWith('prod-0001', 1, undefined);
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('ALWAYS uses the server-side product price, never the client-supplied amount', async () => {
    const paymentClient: IPaymentClient = {
      initiatePayment: jest.fn().mockResolvedValue({ paymentId: 'p1', orderId: 'o1', status: 'accepted' }),
    };
    const publisher = { publish: jest.fn() } as unknown as Publisher;
    const { service, orderRepo } = makeService(paymentClient, publisher);

    // Client tries to lowball the price - server must ignore this and use
    // the real product price (19.99) instead.
    await service.createOrder({ customerId: 'cust-0001', productId: 'prod-0001', amount: 0.01 });

    expect(orderRepo.saved[0].amount).toBe(19.99);
    expect(paymentClient.initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 19.99 }),
      undefined,
    );
  });

  it('still saves the order as pending and does not throw when Payment Service is unreachable', async () => {
    const paymentClient: IPaymentClient = {
      initiatePayment: jest
        .fn()
        .mockRejectedValue(new UpstreamServiceError('payment-service', 'connection refused')),
    };
    const publisher = { publish: jest.fn().mockResolvedValue(true) } as unknown as Publisher;

    const { service, orderRepo } = makeService(paymentClient, publisher);

    const result = await service.createOrder({
      customerId: 'cust-0001',
      productId: 'prod-0001',
      amount: 19.99,
    });

    // The customer still gets a clean pending order - never punished for a
    // downstream outage they have no control over. Crucially, the order was
    // already durably saved BEFORE payment was attempted (consistency fix).
    expect(result.orderStatus).toBe('pending');
    expect(orderRepo.saved[0].paymentInitiated).toBe(false);
    expect(orderRepo.saved).toHaveLength(1);

    // A reconciliation event (with attempts: 1) was published via publisher
    // confirms so the retry worker can pick it up later.
    expect(publisher.publish).toHaveBeenCalledTimes(1);
    const [, , payload] = (publisher.publish as jest.Mock).mock.calls[0];
    expect(payload).toMatchObject({ customerId: 'cust-0001', productId: 'prod-0001', attempts: 1 });
  });

  it('rejects the order outright with ConflictError when stock is insufficient, without ever saving an order', async () => {
    const paymentClient: IPaymentClient = { initiatePayment: jest.fn() };
    const publisher = { publish: jest.fn() } as unknown as Publisher;

    const { service, orderRepo } = makeService(paymentClient, publisher, {
      reserveStock: jest.fn().mockRejectedValue(new ConflictError('Insufficient stock')),
    });

    await expect(
      service.createOrder({ customerId: 'cust-0001', productId: 'prod-0001', amount: 19.99 }),
    ).rejects.toThrow(ConflictError);

    expect(orderRepo.saved).toHaveLength(0);
    expect(paymentClient.initiatePayment).not.toHaveBeenCalled();
  });

  it('releases reserved stock if the order fails to save for an unexpected reason', async () => {
    const paymentClient: IPaymentClient = { initiatePayment: jest.fn() };
    const publisher = { publish: jest.fn() } as unknown as Publisher;
    const releaseStock = jest.fn().mockResolvedValue(undefined);

    const { service, orderRepo } = makeService(paymentClient, publisher, { releaseStock });

    // Force an unexpected DB error on create (not a duplicate-key race).
    jest.spyOn(orderRepo, 'create').mockRejectedValueOnce(new Error('db connection reset'));

    await expect(
      service.createOrder({ customerId: 'cust-0001', productId: 'prod-0001', amount: 19.99 }),
    ).rejects.toThrow('db connection reset');

    expect(releaseStock).toHaveBeenCalledWith('prod-0001', 1, undefined);
  });

  it('replays the existing order on idempotency key match instead of creating a duplicate', async () => {
    const paymentClient: IPaymentClient = {
      initiatePayment: jest.fn().mockResolvedValue({ paymentId: 'p1', orderId: 'o1', status: 'accepted' }),
    };
    const publisher = { publish: jest.fn() } as unknown as Publisher;
    const { service, orderRepo } = makeService(paymentClient, publisher);

    const first = await service.createOrder(
      { customerId: 'cust-0001', productId: 'prod-0001', amount: 19.99 },
      undefined,
      'idem-key-123',
    );

    const second = await service.createOrder(
      { customerId: 'cust-0001', productId: 'prod-0001', amount: 19.99 },
      undefined,
      'idem-key-123',
    );

    expect(second.orderId).toBe(first.orderId);
    expect(orderRepo.saved).toHaveLength(1);
    // Payment should only ever have been attempted once - not on the replay.
    expect(paymentClient.initiatePayment).toHaveBeenCalledTimes(1);
  });

  it('handles a create-race on idempotency key by returning the winning order and releasing its own stock reservation', async () => {
    const paymentClient: IPaymentClient = { initiatePayment: jest.fn() };
    const publisher = { publish: jest.fn() } as unknown as Publisher;
    const releaseStock = jest.fn().mockResolvedValue(undefined);
    const { service, orderRepo } = makeService(paymentClient, publisher, { releaseStock });

    const winningOrder: OrderAttributes = {
      orderId: 'winner-order-id',
      customerId: 'cust-0001',
      productId: 'prod-0001',
      amount: 19.99,
      orderStatus: 'pending',
      paymentInitiated: false,
      idempotencyKey: 'race-key',
      createdAt: new Date(),
    };

    // Simulate true interleaving: our initial findByIdempotencyKey check
    // (before create) sees nothing yet - the other request hasn't committed.
    // Only WHEN our create() call hits the DB does the other request's
    // write become visible, causing our insert to collide.
    jest.spyOn(orderRepo, 'create').mockImplementationOnce(async () => {
      orderRepo.saved.push(winningOrder);
      const err = new Error('E11000 duplicate key error') as Error & { code: number };
      err.code = 11000;
      throw err;
    });

    const result = await service.createOrder(
      { customerId: 'cust-0001', productId: 'prod-0001', amount: 19.99 },
      undefined,
      'race-key',
    );

    expect(result.orderId).toBe('winner-order-id');
    expect(releaseStock).toHaveBeenCalledWith('prod-0001', 1, undefined);
  });

  it('propagates non-upstream errors from the payment client instead of swallowing them', async () => {
    const unexpectedError = new Error('totally unexpected bug');
    const paymentClient: IPaymentClient = {
      initiatePayment: jest.fn().mockRejectedValue(unexpectedError),
    };
    const publisher = { publish: jest.fn() } as unknown as Publisher;

    const { service } = makeService(paymentClient, publisher);

    await expect(
      service.createOrder({ customerId: 'cust-0001', productId: 'prod-0001', amount: 19.99 }),
    ).rejects.toThrow('totally unexpected bug');
  });
});
