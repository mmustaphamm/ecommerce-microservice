import { HttpClient, ApiSuccessResponse, UpstreamServiceError, ConflictError } from '@ecommerce/shared/src';
import { IProductClient, ProductInfo } from './IProductClient';

interface ErrorResponseBody {
  success: false;
  error: { code: string; message: string };
}

export class HttpProductClient implements IProductClient {
  constructor(private readonly httpClient: HttpClient) {}

  async getProduct(productId: string, correlationId?: string): Promise<ProductInfo> {
    const response = await this.httpClient.get<ApiSuccessResponse<ProductInfo>>(
      `/products/${productId}`,
      correlationId,
    );
    return response.data;
  }

  async reserveStock(productId: string, quantity: number, correlationId?: string): Promise<void> {
    try {
      await this.httpClient.patch(
        `/products/${productId}/reserve`,
        { quantity },
        correlationId,
      );
    } catch (err) {
      // Distinguish "product service told us there's no stock" (a legitimate
      // business rejection - should fail the order outright) from "product
      // service is unreachable" (an infra failure - different handling).
      // The shared HttpClient collapses all 4xx into UpstreamServiceError,
      // so we unwrap the original downstream error code from `details`.
      if (err instanceof UpstreamServiceError) {
        const details = err.details as ErrorResponseBody | undefined;
        if (details?.error?.code === 'CONFLICT') {
          throw new ConflictError(`Insufficient stock for product ${productId}`);
        }
      }
      throw err;
    }
  }

  async releaseStock(productId: string, quantity: number, correlationId?: string): Promise<void> {
    await this.httpClient.patch(`/products/${productId}/release`, { quantity }, correlationId);
  }
}
