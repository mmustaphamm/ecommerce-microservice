import Joi from 'joi';

interface Env {
  NODE_ENV: string;
  PORT: number;
  MONGO_URI: string;
  INTERNAL_API_KEY: string;
  LOG_LEVEL: string;
}

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  MONGO_URI: Joi.string().uri().required(),
  INTERNAL_API_KEY: Joi.string().min(16).required(),
  LOG_LEVEL: Joi.string().default('info'),
}).unknown(true);

function loadEnv(): Env {
  const { error, value } = schema.validate(process.env);
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[customer-service] Invalid environment configuration: ${error.message}`);
    process.exit(1);
  }
  return value as Env;
}

export const env = loadEnv();
