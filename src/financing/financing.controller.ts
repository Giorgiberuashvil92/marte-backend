import { Body, Controller, Get, Post, Query } from '@nestjs/common';
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
      merchantPhone?: string;
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

  @Post('lead')
  createLead(
    @Body()
    dto: {
      userId: string;
      requestId: string;
      amount: number;
      phone: string;
      merchantPhone?: string;
      downPayment?: number;
      termMonths?: number;
      personalId?: string;
      note?: string;
    },
  ) {
    return this.financingService.createLead(dto);
  }

  @Get('leads')
  getLeads(@Query('limit') limit?: string) {
    const parsed = Number(limit) || 200;
    return this.financingService.findAllLeads(parsed);
  }
}
