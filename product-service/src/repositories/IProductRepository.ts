import { ProductAttributes } from '../models/Product';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IProductRepository {
  findByProductId(productId: string): Promise<ProductAttributes | null>;
  create(product: ProductAttributes): Promise<ProductAttributes>;
  findAll(page: number, pageSize: number): Promise<PaginatedResult<ProductAttributes>>;

  /**
   * Atomically decrements stock IF at least `quantity` units are available,
   * using a single findOneAndUpdate with a `stock >= quantity` guard in the
   * query filter itself. This is what actually prevents overselling under
   * concurrent requests: two simultaneous "last unit" orders can't both
   * succeed, because MongoDB only lets one of the two conditional updates
   * match the guard at a time. Returns null if there wasn't enough stock.
   */
  reserveStock(productId: string, quantity: number): Promise<ProductAttributes | null>;

  /** Compensating action: adds stock back (e.g. after a failed downstream step). */
  releaseStock(productId: string, quantity: number): Promise<ProductAttributes | null>;
}
