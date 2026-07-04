/**
 * Cross-service data contracts. Defining these once in the shared package
 * means Order Service, Payment Service, and the Worker all code against the
 * exact same shape - a change here surfaces as a compile error everywhere
 * it's used, rather than a silent runtime mismatch between services.
 */

export type OrderStatus = 'pending' | 'confirmed' | 'failed';

/**
 * Body the customer sends to POST /orders on the Order Service.
 *
 * `amount` is intentionally optional and NOT trusted as the charge amount -
 * Order Service always derives the authoritative amount from Product
 * Service's price for the given `productId`. It's accepted here only for
 * backward compatibility with the original spec's request shape and to
 * detect/log client/server price mismatches; it is never what gets charged
 * or persisted as the order's `amount`.
 */
export interface CreateOrderRequest {
  customerId: string;
  productId: string;
  amount?: number;
}

/** Response the Order Service sends back to the customer. */
export interface CreateOrderResponse {
  customerId: string;
  orderId: string;
  productId: string;
  orderStatus: OrderStatus;
}

/** Body the Order Service sends to POST /payments on the Payment Service. */
export interface InitiatePaymentRequest {
  customerId: string;
  orderId: string;
  productId: string;
  amount: number;
}

/** Response the Payment Service sends back to the Order Service. */
export interface InitiatePaymentResponse {
  paymentId: string;
  orderId: string;
  status: 'accepted';
}

/** Message the Payment Service publishes to RabbitMQ for the Worker to persist. */
export interface TransactionCreatedEvent {
  transactionId: string;
  customerId: string;
  orderId: string;
  productId: string;
  amount: number;
  createdAt: string;
}

/**
 * Message published by Order Service when Payment Service is unreachable
 * after retries, and re-published by the retry worker itself (with an
 * incremented `attempts` count) each time a retry attempt fails but
 * attempts remain, via the delay-queue bounce pattern.
 */
export interface PaymentRetryRequestedEvent {
  orderId: string;
  customerId: string;
  productId: string;
  amount: number;
  requestedAt: string;
  attempts: number;
}

/**
 * Body the retry worker sends to Order Service's internal
 * `PATCH /orders/:orderId/payment-status` endpoint once a retried payment
 * attempt either succeeds or permanently exhausts its attempts. Protected
 * by internal service-to-service auth (see `internalAuthMiddleware`) since
 * this mutates order state and should never be reachable by end users.
 */
export interface UpdateOrderPaymentStatusRequest {
  paymentInitiated: boolean;
  orderStatus: OrderStatus;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}
