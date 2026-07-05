import { Request, Response } from 'express';
import { PaymentService } from '../services/PaymentService';
import { ApiSuccessResponse, InitiatePaymentRequest, InitiatePaymentResponse } from '@ecommerce/shared/src';

export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  initiatePayment = async (req: Request, res: Response): Promise<void> => {
    const request = req.body as InitiatePaymentRequest;
    const result = await this.paymentService.processPayment(request, req.correlationId);

    const body: ApiSuccessResponse<InitiatePaymentResponse> = { success: true, data: result };
    res.status(201).json(body);
  };
}
