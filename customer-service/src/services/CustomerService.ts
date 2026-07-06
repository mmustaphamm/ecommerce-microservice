import { ICustomerRepository } from '../repositories/ICustomerRepository';
import { CustomerAttributes } from '../models/Customer';
import { NotFoundError } from '@ecommerce/shared/src';

export class CustomerService {
  constructor(private readonly customerRepo: ICustomerRepository) {}

  async getCustomerById(customerId: string): Promise<CustomerAttributes> {
    const customer = await this.customerRepo.findByCustomerId(customerId);
    if (!customer) {
      throw new NotFoundError('Customer', customerId);
    }
    return customer;
  }

  async createCustomer(customer: CustomerAttributes): Promise<CustomerAttributes> {
    return this.customerRepo.create(customer);
  }
}
