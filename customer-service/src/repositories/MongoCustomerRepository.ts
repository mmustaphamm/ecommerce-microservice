import { ICustomerRepository } from './ICustomerRepository';
import { CustomerModel, CustomerAttributes } from '../models/Customer';

/**
 * Mongoose-backed implementation of `ICustomerRepository`. All Mongoose-
 * specific concerns (lean(), document-to-plain-object mapping) are contained
 * here so the rest of the codebase never imports Mongoose types directly.
 */
export class MongoCustomerRepository implements ICustomerRepository {
  async findByCustomerId(customerId: string): Promise<CustomerAttributes | null> {
    const doc = await CustomerModel.findOne({ customerId }).lean().exec();
    if (!doc) return null;
    return this.toAttributes(doc);
  }

  async create(customer: CustomerAttributes): Promise<CustomerAttributes> {
    const doc = await CustomerModel.create(customer);
    return this.toAttributes(doc.toObject());
  }

  private toAttributes(doc: CustomerAttributes): CustomerAttributes {
    return {
      customerId: doc.customerId,
      name: doc.name,
      email: doc.email,
      createdAt: doc.createdAt,
    };
  }
}
