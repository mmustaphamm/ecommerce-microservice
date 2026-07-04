import Joi from 'joi';

export const createOrderSchema = Joi.object({
  customerId: Joi.string().required(),
  productId: Joi.string().required(),
  // Optional and NOT trusted as the charge amount - see OrderService for
  // why the authoritative price always comes from Product Service.
  amount: Joi.number().positive().optional(),
});

export const orderIdParamsSchema = Joi.object({
  orderId: Joi.string().required(),
});

export const updatePaymentStatusSchema = Joi.object({
  paymentInitiated: Joi.boolean().required(),
  orderStatus: Joi.string().valid('pending', 'confirmed', 'failed').required(),
});
