import { ProductService } from './ProductService';
import { IProductRepository, PaginatedResult } from '../repositories/IProductRepository';
import { ProductAttributes } from '../models/Product';
import { NotFoundError, ConflictError } from '@ecommerce/shared';

/**
 * Fake repository that mimics the ATOMIC reserve/release semantics of the
 * real Mongo implementation (guard-then-mutate as one step), so tests can
 * verify ProductService's behavior without a real database.
 */
class FakeProductRepository implements IProductRepository {
  private products = new Map<string, ProductAttributes>();

  async findByProductId(productId: string): Promise<ProductAttributes | null> {
    return this.products.get(productId) ?? null;
  }

  async create(product: ProductAttributes): Promise<ProductAttributes> {
    this.products.set(product.productId, product);
    return product;
  }

  async findAll(page: number, pageSize: number): Promise<PaginatedResult<ProductAttributes>> {
    const all = Array.from(this.products.values());
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), total: all.length, page, pageSize };
  }

  async reserveStock(productId: string, quantity: number): Promise<ProductAttributes | null> {
    const product = this.products.get(productId);
    if (!product || product.stock < quantity) return null;
    const updated = { ...product, stock: product.stock - quantity };
    this.products.set(productId, updated);
    return updated;
  }

  async releaseStock(productId: string, quantity: number): Promise<ProductAttributes | null> {
    const product = this.products.get(productId);
    if (!product) return null;
    const updated = { ...product, stock: product.stock + quantity };
    this.products.set(productId, updated);
    return updated;
  }
}

describe('ProductService', () => {
  let repo: FakeProductRepository;
  let service: ProductService;

  const sampleProduct: ProductAttributes = {
    productId: 'prod-0001',
    name: 'Wireless Mouse',
    price: 19.99,
    stock: 5,
    createdAt: new Date(),
  };

  beforeEach(() => {
    repo = new FakeProductRepository();
    service = new ProductService(repo);
  });

  it('returns the product when found', async () => {
    await repo.create(sampleProduct);
    await expect(service.getProductById('prod-0001')).resolves.toEqual(sampleProduct);
  });

  it('throws NotFoundError when the product does not exist', async () => {
    await expect(service.getProductById('missing')).rejects.toThrow(NotFoundError);
  });

  it('lists products with pagination metadata', async () => {
    await repo.create(sampleProduct);
    const result = await service.listProducts(1, 20);
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it('reserves stock and decrements it atomically', async () => {
    await repo.create(sampleProduct);
    const updated = await service.reserveStock('prod-0001', 2);
    expect(updated.stock).toBe(3);
  });

  it('throws ConflictError when reserving more stock than available', async () => {
    await repo.create(sampleProduct);
    await expect(service.reserveStock('prod-0001', 999)).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError when reserving stock for a nonexistent product', async () => {
    await expect(service.reserveStock('does-not-exist', 1)).rejects.toThrow(NotFoundError);
  });

  it('releases stock back', async () => {
    await repo.create(sampleProduct);
    await service.reserveStock('prod-0001', 2);
    const released = await service.releaseStock('prod-0001', 2);
    expect(released.stock).toBe(5);
  });
});
