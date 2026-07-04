import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createLogger } from '@ecommerce/shared';
import { createApp } from '../app';
import { ProductModel } from '../models/Product';

describe('Product routes', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp(createLogger({ serviceName: 'product-service:test' }));

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await ProductModel.deleteMany({});
  });

  it('GET /products/:productId returns 200 when found', async () => {
    await ProductModel.create({ productId: 'prod-0001', name: 'Wireless Mouse', price: 19.99, stock: 100 });

    const response = await request(app).get('/products/prod-0001');

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Wireless Mouse');
  });

  it('GET /products/:productId returns 404 when not found', async () => {
    const response = await request(app).get('/products/missing');
    expect(response.status).toBe(404);
  });

  it('GET /products returns paginated products', async () => {
    await ProductModel.create({ productId: 'prod-0001', name: 'Wireless Mouse', price: 19.99, stock: 100 });
    await ProductModel.create({ productId: 'prod-0002', name: 'Keyboard', price: 79.99, stock: 50 });

    const response = await request(app).get('/products');

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.total).toBe(2);
  });

  it('PATCH /products/:productId/reserve requires internal auth', async () => {
    await ProductModel.create({ productId: 'prod-0001', name: 'Wireless Mouse', price: 19.99, stock: 10 });

    const response = await request(app)
      .patch('/products/prod-0001/reserve')
      .send({ quantity: 1 });

    expect(response.status).toBe(403);
  });

  it('PATCH /products/:productId/reserve decrements stock with valid internal auth', async () => {
    await ProductModel.create({ productId: 'prod-0001', name: 'Wireless Mouse', price: 19.99, stock: 10 });

    const response = await request(app)
      .patch('/products/prod-0001/reserve')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string)
      .send({ quantity: 1 });

    expect(response.status).toBe(200);
    expect(response.body.data.stock).toBe(9);
  });

  it('PATCH /products/:productId/reserve returns 409 when stock is insufficient', async () => {
    await ProductModel.create({ productId: 'prod-0001', name: 'Wireless Mouse', price: 19.99, stock: 1 });

    const response = await request(app)
      .patch('/products/prod-0001/reserve')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string)
      .send({ quantity: 5 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });
});
