import {
  Controller,
  Post,
  Get,
  Logger,
  HttpCode,
  HttpStatus,
  Param,
  Body,
  Query,
} from '@nestjs/common';
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

      this.logger.log(
        '✅ Manual რეკურინგ გადახდების დამუშავება დასრულდა:',
        result,
      );

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

  /**
   * Upcoming payments-ის მიღება (როდის უნდა ჩამოვაჭრათ)
   * GET /api/recurring-payments/upcoming?hours=24
   */
  @Get('upcoming')
  async getUpcomingPayments(@Query('hours') hours?: string) {
    try {
      const hoursNumber = hours ? parseInt(hours, 10) : 24;
      const result =
        await this.recurringPaymentsService.getUpcomingPayments(hoursNumber);

      return {
        success: true,
        message: 'Upcoming payments წარმატებით მიღებულია',
        data: result,
      };
    } catch (error) {
      this.logger.error(
        '❌ Upcoming payments-ის მიღების შეცდომა:',
        error instanceof Error ? error.message : 'Unknown error',
      );

      return {
        success: false,
        message: 'Upcoming payments-ის მიღება ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * პირდაპირ order_id-ით recurring payment-ის გაშვება (subscription-ის გარეშე)
   * POST /api/recurring-payments/process-by-order/:orderId
   */
  @Post('process-by-order/:orderId')
  @HttpCode(HttpStatus.OK)
  async processRecurringPaymentByOrderId(
    @Param('orderId') orderId: string,
    @Body() body?: { amount?: number; externalOrderId?: string },
  ) {
    try {
      this.logger.log(
        `🔄 Recurring payment გაშვება order_id: ${orderId}-ით...`,
      );

      const result =
        await this.recurringPaymentsService.processRecurringPaymentByOrderId(
          orderId,
          body?.amount,
          body?.externalOrderId,
        );

      this.logger.log(
        `✅ Recurring payment გაშვება დასრულდა order_id: ${orderId}-ით`,
      );

      return {
        success: true,
        message: 'Recurring payment წარმატებით განხორციელდა',
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `❌ Recurring payment გაშვების შეცდომა order_id: ${orderId}-ით:`,
        error instanceof Error ? error.message : 'Unknown error',
      );

      return {
        success: false,
        message: 'Recurring payment გაშვება ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * კონკრეტული order_id-ით recurring payment-ის ტესტირება
   * POST /api/recurring-payments/test/:orderId
   */
  @Post('test/:orderId')
  @HttpCode(HttpStatus.OK)
  async testRecurringPayment(@Param('orderId') orderId: string) {
    try {
      this.logger.log(`🧪 Recurring payment ტესტი order_id: ${orderId}-ით`);

      const result =
        await this.recurringPaymentsService.testRecurringPaymentByOrderId(
          orderId,
        );

      this.logger.log(
        `✅ Recurring payment ტესტი დასრულდა order_id: ${orderId}-ით`,
      );

      return {
        success: true,
        message: 'Recurring payment ტესტი წარმატებით დასრულდა',
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `❌ Recurring payment ტესტის შეცდომა order_id: ${orderId}-ით:`,
        error instanceof Error ? error.message : 'Unknown error',
      );

      return {
        success: false,
        message: 'Recurring payment ტესტი ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
