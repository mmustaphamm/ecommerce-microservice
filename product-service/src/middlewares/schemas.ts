import Joi from 'joi';

export const getProductParamsSchema = Joi.object({
  productId: Joi.string().pattern(/^prod-\d{4}$/).required().messages({
    'string.pattern.base': 'productId must match format prod-0001',
  }),
});

export const listProductsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

export const stockMutationSchema = Joi.object({
  quantity: Joi.number().integer().positive().required(),
});
