import { Router } from 'express';
import { CustomerController } from '../controllers/CustomerController';
import { MongoCustomerRepository } from '../repositories/MongoCustomerRepository';
import { createCustomerRoutes } from '../routes/customerRoutes';
import { CustomerService } from '../services/CustomerService';

export function createCustomerModule(): Router {
  const router = Router();

  const customerRepository = new MongoCustomerRepository();
  const customerService = new CustomerService(customerRepository);
  const customerController = new CustomerController(customerService);

  router.use('/customers', createCustomerRoutes(customerController));

  return router;
}
