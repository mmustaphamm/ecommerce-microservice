export interface ProductInfo {
  productId: string;
  name: string;
  price: number;
  stock: number;
}

export interface IProductClient {
  getProduct(productId: string, correlationId?: string): Promise<ProductInfo>;

  /**
   * Atomically reserves (decrements) stock for an order. Throws a
   * ConflictError-mapped UpstreamServiceError-like 409 if there isn't
   * enough stock left. Called AFTER validating the product exists, BEFORE
   * payment is attempted, so we never charge for something we can't fulfill.
   */
  reserveStock(productId: string, quantity: number, correlationId?: string): Promise<void>;

  /**
   * Compensating action: releases (increments back) previously reserved
   * stock. Used if a later, genuinely unexpected step fails after stock was
   * already reserved (e.g. the order document fails to save for a reason
   * unrelated to payment) - without this, that stock would be lost forever
   * even though no order actually completed.
   */
  releaseStock(productId: string, quantity: number, correlationId?: string): Promise<void>;
}
