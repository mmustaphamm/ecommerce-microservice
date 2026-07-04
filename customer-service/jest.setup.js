process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/customer_db_test';
process.env.PORT = process.env.PORT || '3001';
process.env.LOG_LEVEL = 'silent';
process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'test-internal-api-key-1234';
