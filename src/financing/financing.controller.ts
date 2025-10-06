import { Body, Controller, Post } from '@nestjs/common';
import { FinancingService } from './financing.service';

@Controller('financing')
export class FinancingController {
  constructor(private readonly financingService: FinancingService) {}

  @Post('apply')
  apply(
    @Body()
    dto: {
      userId: string;
      requestId: string;
      amount: number;
      downPayment?: number;
      termMonths: number;
      personalId?: string;
      phone?: string;
    },
  ) {
    return this.financingService.apply(dto);
  }

  @Post('requests')
  createRequest(
    @Body()
    dto: {
      fullName: string;
      phone: string;
      note?: string;
    },
  ) {
    return this.financingService.createRequest(dto);
  }
}
