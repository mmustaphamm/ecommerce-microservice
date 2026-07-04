import { Request, Response } from 'express';
import { ProductService } from '../services/ProductService';
import { ProductAttributes } from '../models/Product';
import { ApiSuccessResponse } from '@ecommerce/shared';
import { PaginatedResult } from '../repositories/IProductRepository';

interface StockMutationBody {
  quantity: number;
}

export class ProductController {
  constructor(private readonly productService: ProductService) {}

  getProduct = async (req: Request, res: Response): Promise<void> => {
    const { productId } = req.params;
    const product = await this.productService.getProductById(productId);

    const body: ApiSuccessResponse<ProductAttributes> = { success: true, data: product };
    res.status(200).json(body);
  };

  listProducts = async (req: Request, res: Response): Promise<void> => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);

    const result = await this.productService.listProducts(page, pageSize);

    const body: ApiSuccessResponse<PaginatedResult<ProductAttributes>> = {
      success: true,
      data: result,
    };
    res.status(200).json(body);
  };

  /**
   * Internal-only (protected by internalAuthMiddleware): atomically
   * reserves stock. Called by Order Service before it persists an order,
   * so an order is never created for something that's actually out of stock.
   */
  reserveStock = async (req: Request, res: Response): Promise<void> => {
    const { productId } = req.params;
    const { quantity } = req.body as StockMutationBody;

    const product = await this.productService.reserveStock(productId, quantity);

    const body: ApiSuccessResponse<ProductAttributes> = { success: true, data: product };
    res.status(200).json(body);
  };

  /** Internal-only: compensating action to release previously reserved stock. */
  releaseStock = async (req: Request, res: Response): Promise<void> => {
    const { productId } = req.params;
    const { quantity } = req.body as StockMutationBody;

    const product = await this.productService.releaseStock(productId, quantity);

    const body: ApiSuccessResponse<ProductAttributes> = { success: true, data: product };
    res.status(200).json(body);
  };
}
