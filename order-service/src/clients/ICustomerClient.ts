export interface CustomerInfo {
  customerId: string;
  name: string;
  email: string;
}

export interface ICustomerClient {
  getCustomer(customerId: string, correlationId?: string): Promise<CustomerInfo>;
}
