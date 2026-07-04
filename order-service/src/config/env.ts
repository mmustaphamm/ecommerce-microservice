import Joi from 'joi';

interface Env {
  NODE_ENV: string;
  PORT: number;
  MONGO_URI: string;
  RABBITMQ_URL: string;
  PAYMENT_SERVICE_URL: string;
  PRODUCT_SERVICE_URL: string;
  CUSTOMER_SERVICE_URL: string;
  INTERNAL_API_KEY: string;
  LOG_LEVEL: string;
}

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3003),
  MONGO_URI: Joi.string().uri().required(),
  RABBITMQ_URL: Joi.string().uri().required(),
  PAYMENT_SERVICE_URL: Joi.string().uri().required(),
  PRODUCT_SERVICE_URL: Joi.string().uri().required(),
  CUSTOMER_SERVICE_URL: Joi.string().uri().required(),
  INTERNAL_API_KEY: Joi.string().min(8).required(),
  LOG_LEVEL: Joi.string().default('info'),
}).unknown(true);

function loadEnv(): Env {
  const { error, value } = schema.validate(process.env);
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[order-service] Invalid environment configuration: ${error.message}`);
    process.exit(1);
  }
  return value as Env;
}

export const env = loadEnv();
