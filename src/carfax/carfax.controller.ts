import { Controller, Post, Get, Body, Param, Request } from '@nestjs/common';
import { CarFAXService } from './carfax.service';
import { CarFAXRequestDto } from './dto/carfax-request.dto';
import { CarFAXResponseDto } from './dto/carfax-response.dto';

@Controller('carfax')
export class CarFAXController {
  constructor(private readonly carfaxService: CarFAXService) {}

  @Post('report')
  async getCarFAXReport(
    @Request() req: any,
    @Body() request: CarFAXRequestDto,
  ): Promise<CarFAXResponseDto> {
    const userId =
      (req.headers as Record<string, string>)['x-user-id'] || 'demo-user';
    return await this.carfaxService.getCarFAXReport(userId, request);
  }

  @Get('reports')
  async getUserCarFAXReports(@Request() req: any) {
    const userId =
      (req.headers as Record<string, string>)['x-user-id'] || 'demo-user';
    return await this.carfaxService.getUserCarFAXReports(userId);
  }

  @Get('report/:reportId')
  async getCarFAXReportById(
    @Request() req: any,
    @Param('reportId') reportId: string,
  ) {
    const userId =
      (req.headers as Record<string, string>)['x-user-id'] || 'demo-user';
    return await this.carfaxService.getCarFAXReportById(reportId, userId);
  }

  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      service: 'CarFAX API',
      timestamp: new Date().toISOString(),
      message: 'CarFAX სერვისი მუშაობს',
    };
  }
}
