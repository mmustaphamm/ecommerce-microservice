import Joi from 'joi';

export const getCustomerParamsSchema = Joi.object({
  customerId: Joi.string().pattern(/^cust-\d{4}$/).required().messages({
    'string.pattern.base': 'customerId must match format cust-0001',
  }),
});
