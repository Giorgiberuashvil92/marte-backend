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
      throw new HttpException('html ველი აუცილებელია', HttpStatus.BAD_REQUEST);
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

  @Get('users')
  async getAllCarFAXUsers() {
    return await this.carfaxService.getAllCarFAXUsers();
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

  /**
   * VIN-ის მიღება და რეპორტის ფაილად დაბრუნება
   * POST /carfax/report-file
   * Body: { vin: string, format?: 'pdf' | 'html' }
   */
  @Post('report-file')
  async getCarFAXReportAsFile(
    @Request() req: any,
    @Body() body: { vin: string; format?: 'pdf' | 'html' },
    @Res() res: Response,
  ) {
    const userId =
      (req.headers as Record<string, string>)['x-user-id'] || 'admin-user';
    const format = body.format || 'pdf';

    if (!body.vin || body.vin.trim().length === 0) {
      throw new HttpException('VIN კოდი აუცილებელია', HttpStatus.BAD_REQUEST);
    }

    try {
      // მივიღოთ CarFAX რეპორტი
      const report = await this.carfaxService.getCarFAXReport(userId, {
        vin: body.vin.trim().toUpperCase(),
      });

      if (!report.success || !report.data) {
        throw new HttpException(
          'CarFAX რეპორტის მიღება ვერ მოხერხდა',
          HttpStatus.NOT_FOUND,
        );
      }

      // HTML კონტენტის მიღება
      const htmlContent =
        report.data.reportData?.htmlContent ||
        report.data.reportData?.content ||
        '';

      if (!htmlContent) {
        throw new HttpException(
          'HTML კონტენტი ვერ მოიძებნა',
          HttpStatus.NOT_FOUND,
        );
      }

      const fileName = `CarFAX_Report_${body.vin}_${Date.now()}`;

      if (format === 'html') {
        // HTML ფაილის დაბრუნება
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${fileName}.html"`,
        );
        res.send(htmlContent);
      } else {
        // PDF ფაილის გენერაცია და დაბრუნება
        const pdfBuffer = await this.carfaxService.htmlToPdf(
          htmlContent,
          'https://cai.autoimports.ge/',
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${fileName}.pdf"`,
        );
        res.end(pdfBuffer);
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `რეპორტის მიღებისას მოხდა შეცდომა: ${error instanceof Error ? error.message : 'უცნობი შეცდომა'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
