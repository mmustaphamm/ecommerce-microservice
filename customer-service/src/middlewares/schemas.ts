import Joi from 'joi';

export const getCustomerParamsSchema = Joi.object({
  customerId: Joi.string().pattern(/^\d{3}$/).required().messages({
    'string.pattern.base': 'customerId must match format 001',
  }),
});
