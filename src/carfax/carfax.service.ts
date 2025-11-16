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

@Injectable()
export class CarFAXService {
  private readonly logger = new Logger(CarFAXService.name);
  private readonly CARFAX_API_URL =
    'https://dealers.autoimports.ge/api/report/carfax';
  private readonly CARFAX_API_KEY = '23f57611-7a25-4be3-9ade-a311f7c016c3';

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

      const existingReport = await this.carfaxReportModel
        .findOne({ vin: request.vin })
        .exec();

      if (existingReport) {
        this.logger.log(
          `არსებული CarFAX მოხსენება ნაპოვნია VIN: ${request.vin}`,
        );
        return {
          success: true,
          data: {
            vin: existingReport.vin,
            make: existingReport.make,
            model: existingReport.model,
            year: existingReport.year,
            mileage: existingReport.mileage || 0,
            accidents: existingReport.accidents,
            owners: existingReport.owners,
            serviceRecords: existingReport.serviceRecords,
            titleStatus: existingReport.titleStatus,
            lastServiceDate:
              existingReport.lastServiceDate ||
              new Date().toISOString().split('T')[0],
            reportId: existingReport.reportId,
            reportData: existingReport.reportData || null,
          },
          message: 'CarFAX მოხსენება ნაპოვნია ბაზაში',
        };
      }

      // API-სთან დაკავშირება
      const apiResponse = await this.callCarFAXAPI(request.vin);

      if (!apiResponse.success) {
        throw new HttpException(
          apiResponse.error || 'CarFAX API-დან მოხსენება ვერ მოიძებნა',
          HttpStatus.NOT_FOUND,
        );
      }

      // მონაცემების შენახვა ბაზაში
      const newReport = new this.carfaxReportModel({
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
      });

      const savedReport = await newReport.save();
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
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 წამი timeout
      });

      this.logger.log(`CarFAX API პასუხი VIN: ${vin}`, response.data);

      if (response.status === 200 && response.data) {
        // API-ს პასუხის პარსინგი (რეალური API-ს მიხედვით შეიძლება შეიცვალოს)
        const apiData = response.data;

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
              apiData.lastServiceDate || new Date().toISOString().split('T')[0],
            reportId: `CF${Date.now()}`,
            reportData: apiData,
          },
        };
      } else {
        return {
          success: false,
          error: 'CarFAX API-დან მოხსენება ვერ მოიძებნა',
        };
      }
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
}
