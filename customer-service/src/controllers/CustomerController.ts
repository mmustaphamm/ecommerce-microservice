import { Request, Response } from 'express';
import { CustomerService } from '../services/CustomerService';
import { CustomerAttributes } from '../models/Customer';
import { ApiSuccessResponse } from '@ecommerce/shared';

/**
 * Controllers only handle HTTP concerns: parsing the request, calling the
 * service layer, and shaping the response. No business logic or DB access
 * lives here (Single Responsibility).
 */
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  getCustomer = async (req: Request, res: Response): Promise<void> => {
    const { customerId } = req.params;
    const customer = await this.customerService.getCustomerById(customerId);

    const body: ApiSuccessResponse<CustomerAttributes> = {
      success: true,
      data: customer,
    };
    res.status(200).json(body);
  };
}
