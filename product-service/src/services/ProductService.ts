import { IProductRepository, PaginatedResult } from '../repositories/IProductRepository';
import { ProductAttributes } from '../models/Product';
import { NotFoundError, ConflictError } from '@ecommerce/shared/src';

export class ProductService {
  constructor(private readonly productRepo: IProductRepository) {}

  async getProductById(productId: string): Promise<ProductAttributes> {
    const product = await this.productRepo.findByProductId(productId);
    if (!product) {
      throw new NotFoundError('Product', productId);
    }
    return product;
  }

  async listProducts(page: number, pageSize: number): Promise<PaginatedResult<ProductAttributes>> {
    return this.productRepo.findAll(page, pageSize);
  }

  async createProduct(product: ProductAttributes): Promise<ProductAttributes> {
    return this.productRepo.create(product);
  }

  /**
   * Atomically reserves stock. Throws ConflictError (409) if unavailable -
   * this is a legitimate business rejection Order Service should surface to
   * the customer outright, not an infrastructure failure to retry around.
   */
  async reserveStock(productId: string, quantity: number): Promise<ProductAttributes> {
    const updated = await this.productRepo.reserveStock(productId, quantity);
    if (!updated) {
      // Distinguish "doesn't exist" from "exists but insufficient stock"
      // for a clearer error message, at the cost of one extra lookup only
      // on the failure path (the common/success path stays a single query).
      const existing = await this.productRepo.findByProductId(productId);
      if (!existing) {
        throw new NotFoundError('Product', productId);
      }
      throw new ConflictError(
        `Insufficient stock for product ${productId}: requested ${quantity}, available ${existing.stock}`,
      );
    }
    return updated;
  }

  async releaseStock(productId: string, quantity: number): Promise<ProductAttributes> {
    const updated = await this.productRepo.releaseStock(productId, quantity);
    if (!updated) {
      throw new NotFoundError('Product', productId);
    }
    return updated;
  }
}
