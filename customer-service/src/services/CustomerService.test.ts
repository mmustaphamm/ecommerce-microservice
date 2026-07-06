import { CustomerService } from './CustomerService';
import { ICustomerRepository } from '../repositories/ICustomerRepository';
import { CustomerAttributes } from '../models/Customer';
import { NotFoundError } from '@ecommerce/shared/src';

class FakeCustomerRepository implements ICustomerRepository {
  private customers = new Map<string, CustomerAttributes>();

  async findByCustomerId(customerId: string): Promise<CustomerAttributes | null> {
    return this.customers.get(customerId) ?? null;
  }

  async create(customer: CustomerAttributes): Promise<CustomerAttributes> {
    this.customers.set(customer.customerId, customer);
    return customer;
  }
}

describe('CustomerService', () => {
  let repo: FakeCustomerRepository;
  let service: CustomerService;

  beforeEach(() => {
    repo = new FakeCustomerRepository();
    service = new CustomerService(repo);
  });

  it('returns the customer when found', async () => {
    const customer: CustomerAttributes = {
      customerId: 'cust-0001',
      name: 'John Doe',
      email: 'john.doe@example.com',
      createdAt: new Date(),
    };
    await repo.create(customer);

    const result = await service.getCustomerById('cust-0001');

    expect(result).toEqual(customer);
  });

  it('throws NotFoundError when the customer does not exist', async () => {
    await expect(service.getCustomerById('does-not-exist')).rejects.toThrow(NotFoundError);
  });

  it('persists a newly created customer', async () => {
    const customer: CustomerAttributes = {
      customerId: 'cust-0002',
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      createdAt: new Date(),
    };

    await service.createCustomer(customer);

    await expect(service.getCustomerById('cust-0002')).resolves.toEqual(customer);
  });
});
