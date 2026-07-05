import { Request, Response } from 'express';
import { OrderService } from '../services/OrderService';
import {
  ApiSuccessResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  NotFoundError,
  OrderStatusResponse,
  UpdateOrderPaymentStatusRequest,
} from '@ecommerce/shared/src';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  createOrder = async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as CreateOrderRequest;
    const idempotencyKey = req.header(IDEMPOTENCY_KEY_HEADER);

    const order = await this.orderService.createOrder(payload, req.correlationId, idempotencyKey);

    const body: ApiSuccessResponse<CreateOrderResponse> = {
      success: true,
      data: order,
    };
    res.status(201).json(body);
  };

  getOrderStatus = async (req: Request, res: Response): Promise<void> => {
    const { orderId } = req.params;

    const order = await this.orderService.getOrderStatus(orderId);
    if (!order) {
      throw new NotFoundError('Order', orderId);
    }

    const body: ApiSuccessResponse<OrderStatusResponse> = {
      success: true,
      data: order,
    };
    res.status(200).json(body);
  };

  /**
   * Internal-only endpoint (protected by internalAuthMiddleware) called by
   * the payment-retry-worker once a retried payment attempt resolves -
   * either successfully (orderStatus -> confirmed) or permanently
   * (orderStatus -> failed, after exhausting retry attempts).
   */
  updatePaymentStatus = async (req: Request, res: Response): Promise<void> => {
    const { orderId } = req.params;
    const update = req.body as UpdateOrderPaymentStatusRequest;

    const updated = await this.orderService.updatePaymentStatus(orderId, update);
    if (!updated) {
      throw new NotFoundError('Order', orderId);
    }

    const body: ApiSuccessResponse<CreateOrderResponse> = { success: true, data: updated };
    res.status(200).json(body);
  };
}
