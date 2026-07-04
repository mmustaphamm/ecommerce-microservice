import Joi from 'joi';

export const getCustomerParamsSchema = Joi.object({
  customerId: Joi.string().required(),
});
