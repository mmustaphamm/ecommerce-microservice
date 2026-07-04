import Joi from 'joi';

export const getProductParamsSchema = Joi.object({
  productId: Joi.string().required(),
});

export const listProductsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

export const stockMutationSchema = Joi.object({
  quantity: Joi.number().integer().positive().required(),
});
