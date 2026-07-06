import Joi from 'joi';

export const getProductParamsSchema = Joi.object({
  productId: Joi.string().pattern(/^\d{3}$/).required().messages({
    'string.pattern.base': 'productId must match format 001',
  }),
});

export const listProductsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

export const stockMutationSchema = Joi.object({
  quantity: Joi.number().integer().positive().required(),
});
