export interface ProductInfo {
  productId: string;
  name: string;
  price: number;
  stock: number;
}

export interface IProductClient {
  getProduct(productId: string, correlationId?: string): Promise<ProductInfo>;

  reserveStock(productId: string, quantity: number, correlationId?: string): Promise<void>;

  releaseStock(productId: string, quantity: number, correlationId?: string): Promise<void>;
}
