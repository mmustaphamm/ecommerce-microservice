import { CustomerAttributes } from '../models/Customer';

/**
 * Abstraction over customer persistence. `CustomerService` depends on this
 * interface (Dependency Inversion) rather than the concrete Mongoose
 * implementation, which means:
 *  - unit tests can inject an in-memory fake with zero DB setup
 *  - swapping MongoDB for another store later touches only the implementation,
 *    never the business logic that consumes it (Open/Closed)
 */
export interface ICustomerRepository {
  findByCustomerId(customerId: string): Promise<CustomerAttributes | null>;
  create(customer: CustomerAttributes): Promise<CustomerAttributes>;
}
