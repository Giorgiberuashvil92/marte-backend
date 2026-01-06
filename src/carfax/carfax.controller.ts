/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Request,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
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

  @Post('pdf')
  async generatePdfFromHtml(
    @Body() body: { html: string; fileName?: string; baseUrl?: string },
    @Res() res: Response,
  ) {
    if (!body?.html || body.html.trim().length === 0) {
      throw new HttpException(
        'html ველი აუცილებელია',
        HttpStatus.BAD_REQUEST,
      );
    }

    const pdfBuffer = await this.carfaxService.htmlToPdf(
      body.html,
      body.baseUrl || 'https://cai.autoimports.ge/',
    );
    const fileName = body.fileName || 'carfax-report.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.end(pdfBuffer);
  }

  @Get('usage')
  async getCarFAXUsage(@Request() req: any) {
    const userId =
      (req.headers as Record<string, string>)['x-user-id'] || 'demo-user';
    return await this.carfaxService.getCarFAXUsage(userId);
  }

  @Post('increment-usage')
  async incrementCarFAXUsage(@Request() req: any) {
    const userId =
      (req.headers as Record<string, string>)['x-user-id'] || 'demo-user';
    return await this.carfaxService.incrementUsage(userId);
  }

  @Post('add-package')
  async addCarFAXPackage(
    @Request() req: any,
    @Body() body: { credits?: number },
  ) {
    const userId =
      (req.headers as Record<string, string>)['x-user-id'] || 'demo-user';
    const credits = body.credits || 5;
    return await this.carfaxService.addCarFAXPackage(userId, credits);
  }

  @Get('stats')
  async getCarFAXStats(@Request() req: any) {
    const userId =
      (req.headers as Record<string, string>)['x-user-id'] || 'demo-user';
    return await this.carfaxService.getCarFAXStats(userId);
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
