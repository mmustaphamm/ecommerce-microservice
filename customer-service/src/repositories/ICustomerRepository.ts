import { CustomerAttributes } from '../models/Customer';

export interface ICustomerRepository {
  findByCustomerId(customerId: string): Promise<CustomerAttributes | null>;
  create(customer: CustomerAttributes): Promise<CustomerAttributes>;
}
