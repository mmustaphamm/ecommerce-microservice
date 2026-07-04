import Joi from 'joi';

interface Env {
  NODE_ENV: string;
  PORT: number;
  RABBITMQ_URL: string;
  PAYMENT_SERVICE_URL: string;
  ORDER_SERVICE_URL: string;
  INTERNAL_API_KEY: string;
  LOG_LEVEL: string;
}

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3006),
  RABBITMQ_URL: Joi.string().uri().required(),
  PAYMENT_SERVICE_URL: Joi.string().uri().required(),
  ORDER_SERVICE_URL: Joi.string().uri().required(),
  INTERNAL_API_KEY: Joi.string().min(8).required(),
  LOG_LEVEL: Joi.string().default('info'),
}).unknown(true);

function loadEnv(): Env {
  const { error, value } = schema.validate(process.env);
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[payment-retry-worker] Invalid environment configuration: ${error.message}`);
    process.exit(1);
  }
  return value as Env;
}

export const env = loadEnv();
