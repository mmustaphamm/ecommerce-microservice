import { IProductRepository, PaginatedResult } from './IProductRepository';
import { ProductModel, ProductAttributes } from '../models/Product';

export class MongoProductRepository implements IProductRepository {
  async findByProductId(productId: string): Promise<ProductAttributes | null> {
    const doc = await ProductModel.findOne({ productId }).lean().exec();
    if (!doc) return null;
    return this.toAttributes(doc);
  }

  async create(product: ProductAttributes): Promise<ProductAttributes> {
    const doc = await ProductModel.create(product);
    return this.toAttributes(doc.toObject());
  }

  async findAll(page: number, pageSize: number): Promise<PaginatedResult<ProductAttributes>> {
    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      ProductModel.find().skip(skip).limit(pageSize).lean().exec(),
      ProductModel.countDocuments().exec(),
    ]);

    return {
      items: docs.map((doc) => this.toAttributes(doc)),
      total,
      page,
      pageSize,
    };
  }

  async reserveStock(productId: string, quantity: number): Promise<ProductAttributes | null> {
    // The `stock: { $gte: quantity }` guard is what makes this atomic and
    // oversell-proof: MongoDB evaluates the filter and applies the update
    // as a single indivisible operation, so under concurrent requests only
    // as many can succeed as there is actual stock for - the rest correctly
    // receive null (insufficient stock) instead of racing past each other.
    const doc = await ProductModel.findOneAndUpdate(
      { productId, stock: { $gte: quantity } },
      { $inc: { stock: -quantity } },
      { new: true },
    )
      .lean()
      .exec();

    if (!doc) return null;
    return this.toAttributes(doc);
  }

  async releaseStock(productId: string, quantity: number): Promise<ProductAttributes | null> {
    const doc = await ProductModel.findOneAndUpdate(
      { productId },
      { $inc: { stock: quantity } },
      { new: true },
    )
      .lean()
      .exec();

    if (!doc) return null;
    return this.toAttributes(doc);
  }

  private toAttributes(doc: ProductAttributes): ProductAttributes {
    return {
      productId: doc.productId,
      name: doc.name,
      price: doc.price,
      stock: doc.stock,
      createdAt: doc.createdAt,
    };
  }
}
