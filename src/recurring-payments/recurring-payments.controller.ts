import { Controller, Post, Get, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { RecurringPaymentsService } from './recurring-payments.service';

@Controller('api/recurring-payments')
export class RecurringPaymentsController {
  private readonly logger = new Logger(RecurringPaymentsController.name);

  constructor(
    private readonly recurringPaymentsService: RecurringPaymentsService,
  ) {}

  /**
   * Manual trigger რეკურინგ გადახდების დამუშავებისთვის (ტესტირებისთვის)
   * POST /api/recurring-payments/process
   */
  @Post('process')
  @HttpCode(HttpStatus.OK)
  async processRecurringPayments() {
    try {
      this.logger.log('🔄 Manual რეკურინგ გადახდების დამუშავება...');

      const result =
        await this.recurringPaymentsService.processRecurringPaymentsManually();

      this.logger.log('✅ Manual რეკურინგ გადახდების დამუშავება დასრულდა:', result);

      return {
        success: true,
        message: 'რეკურინგ გადახდები წარმატებით დამუშავდა',
        data: result,
      };
    } catch (error) {
      this.logger.error(
        '❌ Manual რეკურინგ გადახდების დამუშავების შეცდომა:',
        error instanceof Error ? error.message : 'Unknown error',
      );

      return {
        success: false,
        message: 'რეკურინგ გადახდების დამუშავება ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cron job-ის სტატუსის შემოწმება
   * GET /api/recurring-payments/status
   */
  @Get('status')
  async getStatus() {
    return {
      success: true,
      message: 'რეკურინგ გადახდების სერვისი მუშაობს',
      cronJob: {
        enabled: true,
        schedule: 'ყოველ საათში ერთხელ',
        timeZone: 'Asia/Tbilisi',
      },
    };
  }
}

