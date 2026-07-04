import Joi from 'joi';

export const initiatePaymentSchema = Joi.object({
  customerId: Joi.string().required(),
  orderId: Joi.string().required(),
  productId: Joi.string().required(),
  amount: Joi.number().positive().required(),
});
