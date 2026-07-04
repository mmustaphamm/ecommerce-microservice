import { Schema, model, Document } from 'mongoose';

/** Domain shape of a customer, independent of Mongoose - used across layers. */
export interface CustomerAttributes {
  customerId: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface CustomerDocument extends CustomerAttributes, Document {}

const customerSchema = new Schema<CustomerDocument>({
  customerId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

export const CustomerModel = model<CustomerDocument>('Customer', customerSchema);
