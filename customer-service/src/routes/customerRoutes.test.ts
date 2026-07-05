import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createLogger } from '@ecommerce/shared/src';
import { createApp } from '../app';
import { CustomerModel } from '../models/Customer';

const internalApiKey = process.env.INTERNAL_API_KEY as string;

/**
 * Integration test: exercises the real Express app (routing, validation
 * middleware, controller, service, and Mongoose repository) against an
 * in-memory MongoDB instance. No real database or network dependency,
 * but far higher confidence than a pure unit test.
 */
describe('GET /customers/:customerId', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await CustomerModel.deleteMany({});
  });

  const app = createApp(createLogger({ serviceName: 'customer-service:test' }));

  it('returns 200 and the customer when found', async () => {
    await CustomerModel.create({
      customerId: 'cust-0001',
      name: 'John Doe',
      email: 'john.doe@example.com',
    });

    const response = await request(app)
      .get('/customers/cust-0001')
      .set('x-internal-api-key', internalApiKey);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.customerId).toBe('cust-0001');
    expect(response.body.data.email).toBe('john.doe@example.com');
  });

  it('returns 404 when the customer does not exist', async () => {
    const response = await request(app)
      .get('/customers/cust-9999')
      .set('x-internal-api-key', internalApiKey);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 without the internal API key', async () => {
    const response = await request(app).get('/customers/cust-0001');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 400 when customerId has an invalid format', async () => {
    const response = await request(app)
      .get('/customers/does-not-exist')
      .set('x-internal-api-key', internalApiKey);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('returns 200 on the health check', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });
});
