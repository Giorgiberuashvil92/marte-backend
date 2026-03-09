import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CarFAXReport,
  CarFAXReportDocument,
} from '../schemas/carfax-report.schema';
import {
  CarFAXUsage,
  CarFAXUsageDocument,
} from '../schemas/carfax-usage.schema';
import { CarFAXRequestDto } from './dto/carfax-request.dto';
import { CarFAXResponseDto } from './dto/carfax-response.dto';
import axios from 'axios';
import { chromium } from 'playwright';

@Injectable()
export class CarFAXService {
  private readonly logger = new Logger(CarFAXService.name);
  private readonly CARFAX_API_URL = 'https://cai.autoimports.ge/api/report/';
  private readonly CARFAX_API_KEY = '23f57611-7a25-4be3-9ade-a311f7c016c3';
  private readonly DEFAULT_CARFAX_LIMIT = 1;

  constructor(
    @InjectModel(CarFAXReport.name)
    private carfaxReportModel: Model<CarFAXReportDocument>,
    @InjectModel(CarFAXUsage.name)
    private carfaxUsageModel: Model<CarFAXUsageDocument>,
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
            reportData: existingReport.reportData || (null as any),
          },
          message: 'CarFAX მოხსენება ნაპოვნია ბაზაში',
        };
      }

      // შევამოწმოთ გამოყენებები ახალი report-ის შექმნამდე
      const canUse = await this.checkAndIncrementUsage(userId);
      if (!canUse) {
        throw new HttpException(
          'CarFAX გამოყენების ლიმიტი ამოიწურა. თქვენ გაქვთ 5 ცალი CarFAX report-ის უფლება.',
          HttpStatus.FORBIDDEN,
        );
      }

      // API-სთან დაკავშირება
      const apiResponse = await this.callCarFAXAPI(request.vin);

      if (!apiResponse.success) {
        // განვსაზღვროთ სწორი HTTP status code შეცდომის ტიპის მიხედვით
        let statusCode = HttpStatus.NOT_FOUND;
        if (apiResponse.error?.includes('ავტორიზაციის შეცდომა')) {
          statusCode = HttpStatus.UNAUTHORIZED;
        } else if (apiResponse.error?.includes('timeout')) {
          statusCode = HttpStatus.REQUEST_TIMEOUT;
        }

        throw new HttpException(
          apiResponse.error || 'CarFAX API-დან მოხსენება ვერ მოიძებნა',
          statusCode,
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
      console.log(`CarFAX API-სთან დაკავშირება VIN: ${vin}`);

      // URL-ის ფორმატირება - PHP-ის მსგავსად
      // PHP: https://cai.autoimports.ge/api/report/carfax?vin=...
      const url = `${this.CARFAX_API_URL}carfax?vin=${encodeURIComponent(vin)}`;
      console.log(`🔗 CarFAX API URL: ${url}`);
      console.log(
        `🔑 CarFAX API Key: ${this.CARFAX_API_KEY.substring(0, 8)}...${this.CARFAX_API_KEY.substring(this.CARFAX_API_KEY.length - 4)}`,
      );

      const response = await axios.get(url, {
        headers: {
          'api-key': this.CARFAX_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'text/html,application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        responseType: 'text',
        timeout: 30000, // 30 წამი timeout (PHP-ში 0 = unlimited, მაგრამ უსაფრთხოებისთვის 30s)
        maxRedirects: 10, // PHP-ში FOLLOWLOCATION = true, maxRedirects = 10
        validateStatus: (status) => status >= 200 && status < 300, // მხოლოდ success status codes
      });

      console.log(
        `📥 CarFAX API Response: Status ${response.status}, Content-Type: ${response.headers['content-type']}, Size: ${response.data?.length || 0} bytes`,
      );

      if (response.status === 200 && response.data) {
        const responseData = response.data;
        const contentType = response.headers['content-type'] || '';

        // შევამოწმოთ, არის თუ არა HTML პასუხი
        const isHtml =
          typeof responseData === 'string' &&
          (responseData.trim().startsWith('<!') ||
            responseData.includes('<!DOCTYPE') ||
            responseData.includes('<html') ||
            contentType.includes('text/html'));

        if (isHtml) {
          // HTML პასუხი - დავაბრუნოთ HTML კონტენტი
          console.log(
            `🔍 CarFAX API-მა HTML დააბრუნა VIN: ${vin}, სიგრძე: ${responseData.length}`,
          );

          return {
            success: true,
            data: {
              vin: vin,
              make: 'უცნობი',
              model: 'უცნობი',
              year: new Date().getFullYear(),
              mileage: 0,
              accidents: 0,
              owners: 1,
              serviceRecords: 0,
              titleStatus: 'Clean',
              lastServiceDate: new Date().toISOString().split('T')[0],
              reportId: `CF${Date.now()}`,
              reportData: {
                htmlContent: responseData,
                contentType: 'text/html',
              },
            },
          };
        } else {
          // JSON პასუხი
          const apiData = responseData;

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
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        const errorData = error.response?.data;

        this.logger.error(
          `CarFAX API შეცდომა VIN: ${vin} - Status: ${status}, StatusText: ${statusText}`,
          errorData,
        );

        if (status === 404) {
          return {
            success: false,
            error: 'CarFAX მოხსენება ვერ მოიძებნა ამ VIN კოდისთვის',
          };
        } else if (status === 401) {
          return {
            success: false,
            error:
              'CarFAX API-სთან ავტორიზაციის შეცდომა. გთხოვთ შეამოწმოთ API key.',
          };
        } else if (error.code === 'ECONNABORTED') {
          return {
            success: false,
            error: 'CarFAX API-სთან დაკავშირების timeout',
          };
        } else if (status) {
          return {
            success: false,
            error: `CarFAX API-სთან შეცდომა (${status}): ${errorData?.message || statusText || 'უცნობი შეცდომა'}`,
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

  async htmlToPdf(html: string, baseUrl?: string): Promise<Buffer> {
    try {
      this.logger.log('PDF გენერაცია HTML-დან');

      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();

      // Set base URL if provided
      if (baseUrl) {
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'ka-GE,ka,en-US,en',
        });
      }

      // Load HTML content
      await page.setContent(html, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
      });

      await browser.close();

      this.logger.log('PDF წარმატებით გენერირდა');

      return Buffer.from(pdfBuffer);
    } catch (error) {
      this.logger.error('PDF გენერაციის შეცდომა', error);
      throw new HttpException(
        'PDF გენერაციისას მოხდა შეცდომა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ინიციალიზაცია CarFAX გამოყენებისთვის მომხმარებლისთვის
   */
  private async initializeUsage(userId: string): Promise<CarFAXUsageDocument> {
    const usage = new this.carfaxUsageModel({
      userId,
      totalLimit: this.DEFAULT_CARFAX_LIMIT,
      used: 0,
      lastResetAt: new Date(),
    });
    const saved = await usage.save();
    return saved as CarFAXUsageDocument;
  }

  /**
   * ამოწმებს და იზრდება CarFAX გამოყენება
   * @returns true თუ გამოყენება შესაძლებელია, false თუ ლიმიტი ამოიწურა
   */
  async checkAndIncrementUsage(userId: string): Promise<boolean> {
    try {
      let usage = await this.carfaxUsageModel.findOne({ userId }).exec();

      // თუ არ არსებობს, შევქმნათ
      if (!usage) {
        usage = (await this.initializeUsage(userId)) as any;
      }

      // შევამოწმოთ, აქვს თუ არა დარჩენილი გამოყენებები
      if (usage && usage.used >= usage.totalLimit) {
        this.logger.warn(
          `CarFAX გამოყენების ლიმიტი ამოიწურა მომხმარებლისთვის: ${userId}`,
        );
        return false;
      }

      // გავზარდოთ გამოყენებული რაოდენობა
      if (usage) {
        usage.used += 1;
        usage.updatedAt = new Date();
        await usage.save();

        this.logger.log(
          `CarFAX გამოყენება გაზრდილია მომხმარებლისთვის: ${userId}, გამოყენებული: ${usage.used}/${usage.totalLimit}`,
        );
      }

      return true;
    } catch (error) {
      this.logger.error(
        `CarFAX გამოყენების შემოწმების შეცდომა მომხმარებლისთვის: ${userId}`,
        error,
      );
      throw new HttpException(
        'CarFAX გამოყენების შემოწმებისას მოხდა შეცდომა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * აბრუნებს CarFAX გამოყენების ინფორმაციას მომხმარებლისთვის
   */
  async getCarFAXUsage(userId: string): Promise<{
    totalLimit: number;
    used: number;
    remaining: number;
    lastResetAt: Date;
  }> {
    try {
      let usage = await this.carfaxUsageModel.findOne({ userId }).exec();

      if (!usage) {
        usage = (await this.initializeUsage(userId)) as any;
      }

      if (!usage) {
        throw new HttpException(
          'CarFAX გამოყენების ინფორმაციის მიღებისას მოხდა შეცდომა',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        totalLimit: usage.totalLimit,
        used: usage.used,
        remaining: usage.totalLimit - usage.used,
        lastResetAt: usage.lastResetAt,
      };
    } catch (error) {
      this.logger.error(
        `CarFAX გამოყენების მიღების შეცდომა მომხმარებლისთვის: ${userId}`,
        error,
      );
      throw new HttpException(
        'CarFAX გამოყენების ინფორმაციის მიღებისას მოხდა შეცდომა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * CarFAX usage-ის გაზრდა (increment) მომხმარებლისთვის
   */
  async incrementUsage(userId: string): Promise<{
    success: boolean;
    totalLimit: number;
    used: number;
    remaining: number;
    message: string;
  }> {
    try {
      let usage = await this.carfaxUsageModel.findOne({ userId }).exec();

      // თუ არ არსებობს, შევქმნათ
      if (!usage) {
        usage = (await this.initializeUsage(userId)) as any;
      }

      // გავზარდოთ გამოყენებული რაოდენობა
      if (usage) {
        usage.used += 1;
        usage.updatedAt = new Date();
        await usage.save();

        this.logger.log(
          `CarFAX გამოყენება გაზრდილია მომხმარებლისთვის: ${userId}, გამოყენებული: ${usage.used}/${usage.totalLimit}`,
        );

        return {
          success: true,
          totalLimit: usage.totalLimit,
          used: usage.used,
          remaining: usage.totalLimit - usage.used,
          message: 'CarFAX გამოყენება წარმატებით გაიზარდა',
        };
      }

      throw new HttpException(
        'CarFAX გამოყენების გაზრდისას მოხდა შეცდომა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } catch (error) {
      this.logger.error(
        `CarFAX გამოყენების გაზრდის შეცდომა მომხმარებლისთვის: ${userId}`,
        error,
      );
      throw new HttpException(
        'CarFAX გამოყენების გაზრდისას მოხდა შეცდომა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * CarFAX usage-ის გაზრდა პაკეტით (5 შემოწმება)
   */
  async addCarFAXPackage(
    userId: string,
    credits: number = 5,
  ): Promise<{
    success: boolean;
    totalLimit: number;
    used: number;
    remaining: number;
    message: string;
  }> {
    try {
      let usage = await this.carfaxUsageModel.findOne({ userId }).exec();

      // თუ არ არსებობს, შევქმნათ
      if (!usage) {
        usage = (await this.initializeUsage(userId)) as any;
      }

      // გავზარდოთ totalLimit-ი credits-ით
      if (usage) {
        usage.totalLimit += credits;
        usage.updatedAt = new Date();
        await usage.save();

        this.logger.log(
          `CarFAX პაკეტი დაემატა მომხმარებლისთვის: ${userId}, დამატებული: ${credits} შემოწმება, ახალი ლიმიტი: ${usage.totalLimit}`,
        );

        return {
          success: true,
          totalLimit: usage.totalLimit,
          used: usage.used,
          remaining: usage.totalLimit - usage.used,
          message: `${credits} CarFAX შემოწმება წარმატებით დაემატა`,
        };
      }

      throw new HttpException(
        'CarFAX პაკეტის დამატებისას მოხდა შეცდომა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } catch (error) {
      this.logger.error(
        `CarFAX პაკეტის დამატების შეცდომა მომხმარებლისთვის: ${userId}`,
        error,
      );
      throw new HttpException(
        'CarFAX პაკეტის დამატებისას მოხდა შეცდომა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * აბრუნებს CarFAX report-ების სტატისტიკას მომხმარებლისთვის
   */
  async getCarFAXStats(userId: string): Promise<{
    totalReports: number;
    usage: {
      totalLimit: number;
      used: number;
      remaining: number;
    };
    recentReports: Array<{
      vin: string;
      make: string;
      model: string;
      year: number;
      createdAt: Date;
    }>;
  }> {
    try {
      // report-ების რაოდენობა
      const totalReports = await this.carfaxReportModel
        .countDocuments({ userId })
        .exec();

      // გამოყენების ინფორმაცია
      const usage = await this.getCarFAXUsage(userId);

      // ბოლო 5 report
      const recentReports = await this.carfaxReportModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('vin make model year createdAt')
        .exec();

      return {
        totalReports,
        usage: {
          totalLimit: usage.totalLimit,
          used: usage.used,
          remaining: usage.remaining,
        },
        recentReports: recentReports.map((report) => ({
          vin: report.vin,
          make: report.make,
          model: report.model,
          year: report.year,
          createdAt: report.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error(
        `CarFAX სტატისტიკის მიღების შეცდომა მომხმარებლისთვის: ${userId}`,
        error,
      );
      throw new HttpException(
        'CarFAX სტატისტიკის მიღებისას მოხდა შეცდომა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * აბრუნებს ყველა იუზერს, რომლებიც აკეთებენ CarFAX მოთხოვნებს
   * მათი სტატისტიკით
   */
  async getAllCarFAXUsers(): Promise<
    Array<{
      userId: string;
      totalReports: number;
      usage: {
        totalLimit: number;
        used: number;
        remaining: number;
      };
      firstReportDate?: Date;
      lastReportDate?: Date;
    }>
  > {
    try {
      this.logger.log('CarFAX მომხმარებლების სიის მოთხოვნა');

      // ვიპოვოთ ყველა უნიკალური userId CarFAXReport collection-იდან
      const uniqueUserIds = await this.carfaxReportModel
        .distinct('userId')
        .exec();

      this.logger.log(
        `ნაპოვნია ${uniqueUserIds.length} უნიკალური მომხმარებელი CarFAX report-ებით`,
      );

      // ვიპოვოთ ყველა მომხმარებელი CarFAXUsage collection-იდანაც
      const usageUserIds = await this.carfaxUsageModel
        .distinct('userId')
        .exec();

      // გავაერთიანოთ ორივე სია
      const allUserIds = [
        ...new Set([...uniqueUserIds, ...usageUserIds]),
      ] as string[];

      this.logger.log(
        `სულ ${allUserIds.length} უნიკალური მომხმარებელი CarFAX-თან დაკავშირებით`,
      );

      // ვაგროვოთ სტატისტიკა თითოეული მომხმარებლისთვის
      const usersStats = await Promise.all(
        allUserIds.map(async (userId) => {
          // report-ების რაოდენობა
          const totalReports = await this.carfaxReportModel
            .countDocuments({ userId })
            .exec();

          // პირველი და ბოლო report-ის თარიღები
          const firstReport = await this.carfaxReportModel
            .findOne({ userId })
            .sort({ createdAt: 1 })
            .select('createdAt')
            .exec();

          const lastReport = await this.carfaxReportModel
            .findOne({ userId })
            .sort({ createdAt: -1 })
            .select('createdAt')
            .exec();

          // გამოყენების ინფორმაცია
          let usage = {
            totalLimit: 5,
            used: 0,
            remaining: 5,
          };

          try {
            const usageData = await this.carfaxUsageModel
              .findOne({ userId })
              .exec();
            if (usageData) {
              usage = {
                totalLimit: usageData.totalLimit,
                used: usageData.used,
                remaining: usageData.totalLimit - usageData.used,
              };
            }
          } catch (error) {
            this.logger.warn(
              `CarFAX usage-ის მიღების შეცდომა მომხმარებლისთვის: ${userId}`,
            );
          }

          return {
            userId,
            totalReports,
            usage,
            firstReportDate: firstReport?.createdAt,
            lastReportDate: lastReport?.createdAt,
          };
        }),
      );

      // დავალაგოთ ბოლო report-ის თარიღის მიხედვით (ახლები ზედა)
      usersStats.sort((a, b) => {
        const dateA = a.lastReportDate?.getTime() || 0;
        const dateB = b.lastReportDate?.getTime() || 0;
        return dateB - dateA;
      });

      this.logger.log(
        `CarFAX მომხმარებლების სია წარმატებით მოიძებნა: ${usersStats.length} მომხმარებელი`,
      );

      return usersStats;
    } catch (error) {
      this.logger.error(
        'CarFAX მომხმარებლების სიის მიღების შეცდომა',
        error,
      );
      throw new HttpException(
        'CarFAX მომხმარებლების სიის მიღებისას მოხდა შეცდომა',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
