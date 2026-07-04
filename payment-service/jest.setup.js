process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '3004';
process.env.RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
process.env.LOG_LEVEL = 'silent';
process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'test-internal-api-key-1234';
