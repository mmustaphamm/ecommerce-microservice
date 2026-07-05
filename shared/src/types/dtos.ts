
export type OrderStatus =
  | 'pending'
  | 'stock_reserved'
  | 'payment_pending'
  | 'confirmed'
  | 'failed';

export interface CreateOrderRequest {
  customerId: string;
  productId: string;
  amount?: number;
}

export interface CreateOrderResponse {
  customerId: string;
  orderId: string;
  productId: string;
  orderStatus: OrderStatus;
}

export interface OrderStatusResponse {
  orderId: string;
  customerId: string;
  productId: string;
  orderStatus: OrderStatus;
  paymentInitiated: boolean;
}

export interface InitiatePaymentRequest {
  customerId: string;
  orderId: string;
  productId: string;
  amount: number;
}

export interface InitiatePaymentResponse {
  paymentId: string;
  orderId: string;
  status: 'accepted';
}

export interface TransactionCreatedEvent {
  transactionId: string;
  customerId: string;
  orderId: string;
  productId: string;
  amount: number;
  createdAt: string;
}

export interface PaymentRetryRequestedEvent {
  orderId: string;
  customerId: string;
  productId: string;
  amount: number;
  requestedAt: string;
  attempts: number;
}

export interface UpdateOrderPaymentStatusRequest {
  paymentInitiated: boolean;
  orderStatus: OrderStatus;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}
