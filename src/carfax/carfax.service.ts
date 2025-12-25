import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CarFAXReport,
  CarFAXReportDocument,
} from '../schemas/carfax-report.schema';
import { CarFAXRequestDto } from './dto/carfax-request.dto';
import { CarFAXResponseDto } from './dto/carfax-response.dto';
import axios from 'axios';
import { chromium } from 'playwright';

@Injectable()
export class CarFAXService {
  private readonly logger = new Logger(CarFAXService.name);
  private readonly CARFAX_API_URL =
    'https://cai.autoimports.ge/api/report/carfax';
  private readonly CARFAX_API_KEY = '21f47811-7a21-4be4-9ade-a311f7c016c9';

  constructor(
    @InjectModel(CarFAXReport.name)
    private carfaxReportModel: Model<CarFAXReportDocument>,
  ) {}

  async getCarFAXReport(
    userId: string,
    request: CarFAXRequestDto,
  ): Promise<CarFAXResponseDto> {
    try {
      this.logger.log(
        `CarFAX მოხსენების მოთხოვნა VIN: ${request.vin} მომხმარებლისთვის: ${userId}`,
      );

      // ჯერ ვიღებთ გარე API-დან, მერე ვინახავთ
      const apiResponse = await this.callCarFAXAPI(request.vin);

      if (!apiResponse.success) {
        throw new HttpException(
          apiResponse.error || 'CarFAX API-დან მოხსენება ვერ მოიძებნა',
          HttpStatus.NOT_FOUND,
        );
      }

      const payload = {
        userId,
        vin: request.vin,
        make: apiResponse.data?.make || 'უცნობი',
        model: apiResponse.data?.model || 'უცნობი',
        year: apiResponse.data?.year || new Date().getFullYear(),
        mileage: apiResponse.data?.mileage || 0,
        accidents: apiResponse.data?.accidents || 0,
        owners: apiResponse.data?.owners || 1,
        serviceRecords: apiResponse.data?.serviceRecords || 0,
        titleStatus: apiResponse.data?.titleStatus || 'Clean',
        lastServiceDate:
          apiResponse.data?.lastServiceDate ||
          new Date().toISOString().split('T')[0],
        reportId: apiResponse.data?.reportId || `CF${Date.now()}`,
        reportData: apiResponse.data?.reportData || null,
      };

      const savedReport = await this.carfaxReportModel.findOneAndUpdate(
        { vin: request.vin },
        payload,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      this.logger.log(`CarFAX მოხსენება შენახულია ბაზაში VIN: ${request.vin}`);

      return {
        success: true,
        data: {
          vin: savedReport.vin,
          make: savedReport.make,
          model: savedReport.model,
          year: savedReport.year,
          mileage: savedReport.mileage || 0,
          accidents: savedReport.accidents,
          owners: savedReport.owners,
          serviceRecords: savedReport.serviceRecords,
          titleStatus: savedReport.titleStatus,
          lastServiceDate:
            savedReport.lastServiceDate ||
            new Date().toISOString().split('T')[0],
          reportId: savedReport.reportId,
          reportData: savedReport.reportData || null,
        },
        message: 'CarFAX მოხსენება წარმატებით მოიძებნა და შენახულია',
      };
    } catch (error) {
      this.logger.error(
        `CarFAX მოხსენების მიღების შეცდომა VIN: ${request.vin}`,
        error,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'CarFAX მოხსენების მიღებისას მოხდა შეცდომა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async callCarFAXAPI(vin: string): Promise<CarFAXResponseDto> {
    try {
      this.logger.log(`CarFAX API-სთან დაკავშირება VIN: ${vin}`);

      const response = await axios.get(`${this.CARFAX_API_URL}?vin=${vin}`, {
        headers: {
          'api-key': this.CARFAX_API_KEY,
          Accept: 'text/html',
          'User-Agent': 'curl/7.79.1', // match PHP curl UA
        },
        timeout: 30000, // 30 წამი timeout
        responseType: 'text',
        transformResponse: r => r, // prevent JSON parse
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: () => true, // we handle non-2xx manually
      });

      this.logger.log(
        `CarFAX API პასუხი VIN: ${vin} status: ${response.status}`,
      );

      const contentType = response.headers['content-type'] || '';
      const body = response.data as string;

      // If HTML returned, wrap minimal data and htmlContent
      const isHtml =
        contentType.includes('text/html') ||
        body.trim().startsWith('<') ||
        body.toLowerCase().includes('<html');

      if (response.status === 200 && isHtml) {
        return {
          success: true,
          data: {
            vin,
            make: 'უცნობი',
            model: 'უცნობი',
            year: new Date().getFullYear(),
            mileage: 0,
            accidents: 0,
            owners: 1,
            serviceRecords: 0,
            titleStatus: 'უცნობი',
            reportId: `CF${Date.now()}`,
            reportData: { htmlContent: body, contentType },
          },
        };
      }

      // fallback JSON parse if not HTML
      try {
        const apiData = typeof body === 'string' ? JSON.parse(body) : body;
        if (response.status === 200 && apiData) {
          return {
            success: true,
            data: {
              vin: vin,
              make: apiData.make || 'უცნობი',
              model: apiData.model || 'უცნობი',
              year: apiData.year || new Date().getFullYear(),
              mileage: apiData.mileage || 0,
              accidents: apiData.accidents || 0,
              owners: apiData.owners || 1,
              serviceRecords: apiData.serviceRecords || 0,
              titleStatus: apiData.titleStatus || 'Clean',
              lastServiceDate:
                apiData.lastServiceDate ||
                new Date().toISOString().split('T')[0],
              reportId: `CF${Date.now()}`,
              reportData: apiData,
            },
          };
        }
      } catch {
        // ignore JSON parse error
      }

      return {
        success: false,
        error: 'CarFAX API-დან მოხსენება ვერ მოიძებნა',
      };
    } catch (error) {
      this.logger.error(
        `CarFAX API-სთან დაკავშირების შეცდომა VIN: ${vin}`,
        error,
      );

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return {
            success: false,
            error: 'CarFAX მოხსენება ვერ მოიძებნა ამ VIN კოდისთვის',
          };
        } else if (error.response?.status === 401) {
          return {
            success: false,
            error: 'CarFAX API-სთან ავტორიზაციის შეცდომა',
          };
        } else if (error.code === 'ECONNABORTED') {
          return {
            success: false,
            error: 'CarFAX API-სთან დაკავშირების timeout',
          };
        }
      }

      return {
        success: false,
        error: 'CarFAX API-სთან დაკავშირების შეცდომა',
      };
    }
  }

  async getUserCarFAXReports(userId: string): Promise<CarFAXReport[]> {
    try {
      this.logger.log(`მომხმარებლის CarFAX მოხსენებების მოთხოვნა: ${userId}`);

      const reports = await this.carfaxReportModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .exec();

      this.logger.log(
        `ნაპოვნია ${reports.length} CarFAX მოხსენება მომხმარებლისთვის: ${userId}`,
      );

      return reports;
    } catch (error) {
      this.logger.error(
        `მომხმარებლის CarFAX მოხსენებების მიღების შეცდომა: ${userId}`,
        error,
      );
      throw new HttpException(
        'CarFAX მოხსენებების მიღებისას მოხდა შეცდომა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCarFAXReportById(
    reportId: string,
    userId: string,
  ): Promise<CarFAXReport> {
    try {
      this.logger.log(
        `CarFAX მოხსენების მოთხოვნა ID: ${reportId} მომხმარებლისთვის: ${userId}`,
      );

      const report = await this.carfaxReportModel
        .findOne({ reportId, userId })
        .exec();

      if (!report) {
        throw new HttpException(
          'CarFAX მოხსენება ვერ მოიძებნა',
          HttpStatus.NOT_FOUND,
        );
      }

      this.logger.log(`CarFAX მოხსენება ნაპოვნია ID: ${reportId}`);

      return report;
    } catch (error) {
      this.logger.error(
        `CarFAX მოხსენების მიღების შეცდომა ID: ${reportId}`,
        error,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'CarFAX მოხსენების მიღებისას მოხდა შეცდომა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async htmlToPdf(html: string, baseUrl = 'https://cai.autoimports.ge/'): Promise<Buffer> {
    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });

      // Ensure base tag for relative assets and charset
      let wrapped = html;
      const hasHead = wrapped.toLowerCase().includes('<head');
      if (hasHead) {
        if (!/charset=/i.test(wrapped)) {
          wrapped = wrapped.replace('<head>', '<head><meta charset="UTF-8">');
        }
        if (!/<base\s+/i.test(wrapped)) {
          wrapped = wrapped.replace('<head>', `<head><base href="${baseUrl}">`);
        }
      } else {
        wrapped = `<!DOCTYPE html><html><head><meta charset="UTF-8"><base href="${baseUrl}"></head><body>${html}</body></html>`;
      }

      await page.setContent(wrapped, { waitUntil: 'networkidle' });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });
      await browser.close();
      return pdf;
    } catch (error) {
      this.logger.error('HTML -> PDF გარდაქმნის შეცდომა', error as any);
      throw new HttpException(
        'PDF გენერაცია ვერ მოხერხდა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (browser) {
        await browser.close().catch(() => undefined);
      }
    }
  }
}
