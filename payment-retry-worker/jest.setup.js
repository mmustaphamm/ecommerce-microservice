process.env.NODE_ENV = 'test';
process.env.RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
process.env.PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004';
process.env.ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3003';
process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'test-internal-api-key-1234';
process.env.LOG_LEVEL = 'silent';
process.env.PORT = process.env.PORT || '3006';
