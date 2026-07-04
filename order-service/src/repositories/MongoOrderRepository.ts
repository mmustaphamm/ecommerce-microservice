import { IOrderRepository } from './IOrderRepository';
import { OrderModel, OrderAttributes } from '../models/Order';
import { OrderStatus } from '@ecommerce/shared';

export class MongoOrderRepository implements IOrderRepository {
  async create(order: OrderAttributes): Promise<OrderAttributes> {
    const doc = await OrderModel.create(order);
    return this.toAttributes(doc.toObject());
  }

  async findByOrderId(orderId: string): Promise<OrderAttributes | null> {
    const doc = await OrderModel.findOne({ orderId }).lean().exec();
    if (!doc) return null;
    return this.toAttributes(doc);
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<OrderAttributes | null> {
    const doc = await OrderModel.findOne({ idempotencyKey }).lean().exec();
    if (!doc) return null;
    return this.toAttributes(doc);
  }

  async updatePaymentStatus(
    orderId: string,
    update: { paymentInitiated: boolean; orderStatus: OrderStatus },
  ): Promise<OrderAttributes | null> {
    const doc = await OrderModel.findOneAndUpdate(
      { orderId },
      { $set: update },
      { new: true },
    )
      .lean()
      .exec();
    if (!doc) return null;
    return this.toAttributes(doc);
  }

  private toAttributes(doc: OrderAttributes): OrderAttributes {
    return {
      orderId: doc.orderId,
      customerId: doc.customerId,
      productId: doc.productId,
      amount: doc.amount,
      orderStatus: doc.orderStatus,
      paymentInitiated: doc.paymentInitiated,
      idempotencyKey: doc.idempotencyKey,
      createdAt: doc.createdAt,
    };
  }
}
