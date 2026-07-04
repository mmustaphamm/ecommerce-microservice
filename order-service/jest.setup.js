process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/order_db_test';
process.env.PORT = process.env.PORT || '3003';
process.env.RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
process.env.PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004';
process.env.PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
process.env.CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL || 'http://localhost:3001';
process.env.LOG_LEVEL = 'silent';
