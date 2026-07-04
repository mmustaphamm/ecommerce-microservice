import { Schema, model, Document } from 'mongoose';

export interface ProductAttributes {
  productId: string;
  name: string;
  price: number;
  stock: number;
  createdAt: Date;
}

export interface ProductDocument extends ProductAttributes, Document {}

const productSchema = new Schema<ProductDocument>({
  productId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export const ProductModel = model<ProductDocument>('Product', productSchema);
