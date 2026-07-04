import Joi from 'joi';

interface Env {
  NODE_ENV: string;
  PORT: number;
  MONGO_URI: string;
  LOG_LEVEL: string;
}

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  MONGO_URI: Joi.string().uri().required(),
  LOG_LEVEL: Joi.string().default('info'),
}).unknown(true);

/**
 * Validates process.env at startup and exits fast with a clear message if
 * required config is missing, rather than letting the service boot into a
 * broken state and fail confusingly later (e.g. on the first DB call).
 */
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
