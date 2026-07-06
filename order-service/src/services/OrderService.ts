import { v4 as uuidv4 } from 'uuid';
import type { Logger } from 'pino';
import {
  UpstreamServiceError,
  Publisher,
  TOPOLOGY,
  CreateOrderRequest,
  CreateOrderResponse,
  OrderStatusResponse,
  PaymentRetryRequestedEvent,
  OrderStatus,
} from '@ecommerce/shared/src';
import { IOrderRepository } from '../repositories/IOrderRepository';
import { IPaymentClient } from '../clients/IPaymentClient';
import { IProductClient } from '../clients/IProductClient';
import { ICustomerClient } from '../clients/ICustomerClient';
import { OrderAttributes } from '../models/Order';

const ORDER_QUANTITY = 1;

const MONGO_DUPLICATE_KEY_CODE = 11000;

export class OrderService {
  constructor(
    private readonly orderRepo: IOrderRepository,
    private readonly paymentClient: IPaymentClient,
    private readonly productClient: IProductClient,
    private readonly customerClient: ICustomerClient,
    private readonly publisher: Publisher,
    private readonly logger: Logger,
  ) {}

  async createOrder(
    request: CreateOrderRequest,
    correlationId?: string,
    idempotencyKey?: string,
  ): Promise<CreateOrderResponse> {
    if (idempotencyKey) {
      const existing = await this.orderRepo.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        this.logger.info(
          { idempotencyKey, orderId: existing.orderId },
          'Idempotent replay - returning existing order instead of creating a new one',
        );
        return this.toResponse(existing);
      }
    }

    await this.customerClient.getCustomer(request.customerId, correlationId);
    const product = await this.productClient.getProduct(request.productId, correlationId);

    const authoritativeAmount = product.price;
    if (request.amount !== undefined && Math.abs(request.amount - authoritativeAmount) > 0.001) {
      this.logger.warn(
        { clientAmount: request.amount, actualPrice: authoritativeAmount, productId: request.productId },
        'Client-supplied amount does not match product price - ignoring client value and using server price',
      );
    }

    await this.productClient.reserveStock(request.productId, ORDER_QUANTITY, correlationId);

    const orderId = uuidv4();
    let saved: OrderAttributes;

    try {
      saved = await this.orderRepo.create({
        orderId,
        customerId: request.customerId,
        productId: request.productId,
        amount: authoritativeAmount,
        orderStatus: 'stock_reserved',
        paymentInitiated: false,
        idempotencyKey,
        createdAt: new Date(),
      });
    } catch (err) {
      const isDuplicateIdempotencyKey =
        idempotencyKey && (err as { code?: number }).code === MONGO_DUPLICATE_KEY_CODE;

      // Either a genuine unexpected DB error, or a race where a concurrent
      // request with the same idempotency key won. Either way, we already
      // reserved stock for an order that will never exist under THIS
      // orderId - release it so it isn't lost forever.
      await this.compensateStockRelease(request.productId, correlationId);

      if (isDuplicateIdempotencyKey) {
        const existing = await this.orderRepo.findByIdempotencyKey(idempotencyKey!);
        if (existing) {
          this.logger.info(
            { idempotencyKey, orderId: existing.orderId },
            'Lost a create race on idempotency key - returning the order the other request created',
          );
          return this.toResponse(existing);
        }
      }

      throw err;
    }

    const paymentPending = await this.orderRepo.updatePaymentStatus(orderId, {
      paymentInitiated: false,
      orderStatus: 'payment_pending',
    });
    if (paymentPending) {
      saved = paymentPending;
    }

    const paymentInitiated = await this.tryInitiatePayment(
      {
        customerId: request.customerId,
        productId: request.productId,
        orderId,
        amount: authoritativeAmount,
      },
      correlationId,
    );

    if (paymentInitiated) {
      const updated = await this.orderRepo.updatePaymentStatus(orderId, {
        paymentInitiated: true,
        orderStatus: 'confirmed',
      });
      if (updated) {
        saved = updated;
      }
    }

    return this.toResponse(saved);
  }

  
  private async tryInitiatePayment(
    payload: { customerId: string; productId: string; orderId: string; amount: number },
    correlationId?: string,
  ): Promise<boolean> {
    try {
      await this.paymentClient.initiatePayment(
        {
          customerId: payload.customerId,
          orderId: payload.orderId,
          productId: payload.productId,
          amount: payload.amount,
        },
        correlationId,
      );
      return true;
    } catch (err) {
      if (!(err instanceof UpstreamServiceError)) {
        // Unexpected error shape - re-throw, since we can't reason about it safely.
        throw err;
      }

      this.logger.warn(
        { err, orderId: payload.orderId },
        'Payment Service unreachable after retries - degrading gracefully and queuing for reconciliation',
      );

      const retryEvent: PaymentRetryRequestedEvent = {
        orderId: payload.orderId,
        customerId: payload.customerId,
        productId: payload.productId,
        amount: payload.amount,
        requestedAt: new Date().toISOString(),
        attempts: 1,
      };

      try {
        // Publisher confirms: this resolves only once the broker has
        // durably accepted the message, not just the local write buffer.
        await this.publisher.publish(
          TOPOLOGY.paymentRetry.exchange,
          TOPOLOGY.paymentRetry.routingKey,
          retryEvent,
          correlationId,
        );
      } catch (publishErr) {
        // Known residual gap (documented in README): if even the broker
        // confirm fails here, this order is stuck pending with no
        // reconciliation trigger until an operator or a periodic sweeper
        // job notices it. We log loudly rather than silently losing it.
        this.logger.error(
          { publishErr, orderId: payload.orderId },
          'Failed to publish payment-retry event after broker confirm failure - order will need manual reconciliation',
        );
      }

      return false;
    }
  }

  private async compensateStockRelease(productId: string, correlationId?: string): Promise<void> {
    try {
      await this.productClient.releaseStock(productId, ORDER_QUANTITY, correlationId);
    } catch (releaseErr) {
      this.logger.error(
        { releaseErr, productId },
        'Failed to release reserved stock during compensation - stock count may be understated',
      );
    }
  }

  /**
   * Called by the internal PATCH /orders/:orderId/payment-status endpoint,
   * which the payment-retry-worker hits once a retried payment attempt
   * resolves. Returns null (mapped to 404 by the controller) if the order
   * doesn't exist, rather than throwing, since "not found" is an expected
   * outcome the caller needs to branch on.
   */
  async updatePaymentStatus(
    orderId: string,
    update: { paymentInitiated: boolean; orderStatus: OrderStatus },
  ): Promise<CreateOrderResponse | null> {
    const updated = await this.orderRepo.updatePaymentStatus(orderId, update);
    if (!updated) return null;
    return this.toResponse(updated);
  }

  async getOrderStatus(orderId: string): Promise<OrderStatusResponse | null> {
    const order = await this.orderRepo.findByOrderId(orderId);
    if (!order) return null;

    return {
      orderId: order.orderId,
      customerId: order.customerId,
      productId: order.productId,
      orderStatus: order.orderStatus,
      paymentInitiated: order.paymentInitiated,
    };
  }

  private toResponse(order: OrderAttributes): CreateOrderResponse {
    return {
      customerId: order.customerId,
      orderId: order.orderId,
      productId: order.productId,
      orderStatus: order.orderStatus,
    };
  }
}
