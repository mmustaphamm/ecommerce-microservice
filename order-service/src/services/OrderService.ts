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

/** Every order in this demo is for a single unit of a single product. */
const ORDER_QUANTITY = 1;

/** Mongo's duplicate-key error code, used to detect a race on idempotencyKey. */
const MONGO_DUPLICATE_KEY_CODE = 11000;

/**
 * Orchestrates order creation across the customer, product, and payment
 * services. This is the busiest class in the system, so it's worth being
 * explicit about the flow and *why* each failure is handled differently:
 *
 *  - Customer/Product not found, or insufficient stock -> these are genuine
 *    bad requests / business rejections, so we let them fail outright with
 *    a 4xx (404 or 409). No order is created, no stock is touched.
 *
 *  - Payment Service unreachable (after the shared HttpClient's built-in
 *    retries AND circuit breaker are exhausted) -> this is an
 *    *infrastructure* failure, not a bad request. We do NOT fail the
 *    customer's order for this. The order (already durably saved as
 *    `payment_pending` BEFORE we attempted payment - see below) stays in
 *    that state with
 *    `paymentInitiated: false`, and a `payment.retry.requested` event is
 *    published for the retry worker to reconcile later.
 *
 * Ordering of operations matters here and fixes a real consistency bug from
 * the first version of this service: previously we called Payment Service
 * BEFORE saving the order, which meant a payment could succeed while the
 * order was never persisted (e.g. a DB blip right after payment). Now we:
 *   1. validate customer + product exist
 *   2. atomically reserve stock (fails outright, cleanly, if insufficient)
 *   3. save the order as `stock_reserved` FIRST
 *   4. move it to `payment_pending`
 *   5. only then attempt payment
 *   6. update the already-saved order's payment fields based on the outcome
 * This guarantees an order record exists before money ever moves, and a
 * step-4/5 failure never leaves a "phantom" payment with no order behind it.
 */
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

    // Validate referenced entities exist. Letting these propagate as-is
    // (404/502/409 from the shared HttpClient / product client) is correct:
    // an order for a nonexistent customer or product, or one we can't
    // fulfill, should never be created.
    await this.customerClient.getCustomer(request.customerId, correlationId);
    const product = await this.productClient.getProduct(request.productId, correlationId);

    // SECURITY / TRUST BOUNDARY: never trust a client-supplied charge
    // amount. The authoritative price always comes from Product Service,
    // which we just fetched. If the client sent a different `amount`, we
    // log it (useful for catching buggy or malicious clients) but always
    // charge and persist the server-derived price.
    const authoritativeAmount = product.price;
    if (request.amount !== undefined && Math.abs(request.amount - authoritativeAmount) > 0.001) {
      this.logger.warn(
        { clientAmount: request.amount, actualPrice: authoritativeAmount, productId: request.productId },
        'Client-supplied amount does not match product price - ignoring client value and using server price',
      );
    }

    // Atomically reserve stock before creating the order or touching
    // payment. If this throws (ConflictError), nothing else has happened
    // yet, so there is nothing to compensate/roll back.
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

    // Only now, with the order durably persisted as payment_pending, do we attempt
    // payment. A failure past this point can never leave an "orphaned"
    // payment with no corresponding order.
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
    // If payment was not initiated, the order already sits as payment_pending /
    // paymentInitiated: false - nothing further to
    // update here. The retry worker will call our internal
    // PATCH /orders/:orderId/payment-status endpoint once it resolves.

    return this.toResponse(saved);
  }

  /**
   * Attempts to initiate payment. Returns whether it succeeded, and never
   * throws for infrastructure-type failures - a payment-service outage must
   * never prevent the (already-saved) order from being returned to the
   * customer.
   */
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
