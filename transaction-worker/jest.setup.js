process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/payment_db_test';
process.env.RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
process.env.LOG_LEVEL = 'silent';
process.env.PORT = process.env.PORT || '3005';
