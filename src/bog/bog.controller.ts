import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BOGPaymentService } from './bog-payment.service';
import { BOGOAuthService } from './bog-oauth.service';
import { PaymentsService } from '../payments/payments.service';
import {
  BOGOrderRequestDto,
  BOGOrderResponseDto,
  BOGPaymentStatusDto,
  BOGRecurringPaymentDto,
  BOGRecurringPaymentResponseDto,
} from './dto/bog-payment.dto';
import { Payment, PaymentDocument } from '../schemas/payment.schema';

@Controller('bog')
export class BOGController {
  private readonly logger = new Logger(BOGController.name);

  constructor(
    private readonly bogPaymentService: BOGPaymentService,
    private readonly bogOAuthService: BOGOAuthService,
    private readonly paymentsService: PaymentsService,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
  ) {}

  /**
   * BOG-ში შეკვეთის შექმნა
   * POST /bog/create-order
   */
  @Post('create-order')
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Body() orderData: BOGOrderRequestDto,
  ): Promise<BOGOrderResponseDto> {
    try {
      this.logger.log('🔄 BOG შეკვეთის შექმნის მოთხოვნა მიღებულია');

      const result = await this.bogPaymentService.createOrder(orderData);

      this.logger.log('✅ BOG შეკვეთა წარმატებით შეიქმნა:', result.id);

      return result;
    } catch (error: any) {
      this.logger.error(
        '❌ BOG შეკვეთის შექმნის შეცდომა:',
        (error as Error).message,
      );
      throw error;
    }
  }

  /**
   * BOG შეკვეთის სტატუსის შემოწმება
   * GET /bog/order-status/:orderId
   */
  @Get('order-status/:orderId')
  async getOrderStatus(
    @Param('orderId') orderId: string,
  ): Promise<BOGPaymentStatusDto> {
    try {
      this.logger.log(`🔍 BOG შეკვეთის სტატუსის შემოწმება: ${orderId}`);

      const result = await this.bogPaymentService.getOrderStatus(orderId);

      this.logger.log('✅ BOG შეკვეთის სტატუსი მიღებულია:', result.status);

      return result;
    } catch (error: any) {
      this.logger.error(
        '❌ BOG შეკვეთის სტატუსის შემოწმების შეცდომა:',
        (error as Error).message,
      );
      throw error;
    }
  }

  /**
   * BOG OAuth token-ის სტატუსის შემოწმება (debug endpoint)
   * GET /bog/oauth-status
   */
  @Get('oauth-status')
  async getOAuthStatus(): Promise<{
    isTokenValid: boolean;
    expiresAt: number | null;
    message: string;
  }> {
    try {
      const isTokenValid = await this.bogOAuthService.isTokenValid();
      const expiresAt = this.bogOAuthService.getTokenExpiryTime();

      return {
        isTokenValid,
        expiresAt,
        message: isTokenValid
          ? 'Token ვალიდურია'
          : 'Token არ არის ვალიდური ან არ არსებობს',
      };
    } catch (error) {
      this.logger.error(
        '❌ BOG OAuth სტატუსის შემოწმების შეცდომა:',
        (error as Error).message,
      );

      return {
        isTokenValid: false,
        expiresAt: null,
        message: 'OAuth სტატუსის შემოწმება ვერ მოხერხდა',
      };
    }
  }

  /**
   * BOG გადახდის დეტალების მიღება
   * GET /bog/payment-details/:orderId
   * BOG API-დან გადახდის სრული დეტალების მიღება
   */
  @Get('payment-details/:orderId')
  async getPaymentDetails(@Param('orderId') orderId: string): Promise<any> {
    try {
      this.logger.log(`🔍 BOG გადახდის დეტალების მიღება: ${orderId}`);

      const result = await this.bogPaymentService.getPaymentDetails(orderId);

      this.logger.log('✅ BOG გადახდის დეტალები მიღებულია:', result.order_id);

      return result;
    } catch (error: any) {
      this.logger.error(
        '❌ BOG გადახდის დეტალების მიღების შეცდომა:',
        (error as Error).message,
      );
      throw error;
    }
  }

  /**
   * BOG Payment Callback Handler
   * POST /bog/callback
   * BOG-ისგან მიღებული callback-ების დამუშავება
   */
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  async handleBOGCallback(
    @Body() callbackData: any,
    @Headers() headers: Record<string, any>,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log('🔄 BOG Callback მიღებულია:', {
        headers: headers,
        body: callbackData,
      });

      // BOG callback-ის სტრუქტურის შემოწმება
      const { order_id, status, amount, currency } = callbackData;

      if (!order_id) {
        this.logger.error('❌ BOG Callback-ში არ არის order_id');
        return {
          success: false,
          message: 'Order ID არ არის მოწოდებული',
        };
      }

      this.logger.log(`📊 BOG გადახდის დეტალები:`, {
        order_id,
        status,
        amount,
        currency,
      });

      // გადახდის სტატუსის დამუშავება
      if (status === 'completed' || status === 'success') {
        this.logger.log(`✅ BOG გადახდა წარმატებულია: ${order_id}`);

        // Payment token-ის (order_id) შენახვა recurring payment-ებისთვის
        try {
          // ვპოულობთ payment-ს ამ orderId-ით
          const payment = await this.paymentModel
            .findOne({ orderId: order_id })
            .exec();

          if (payment) {
            // შევინახოთ order_id როგორც paymentToken recurring payment-ებისთვის
            await this.paymentsService.savePaymentToken(order_id, order_id);
            this.logger.log(
              `💾 Payment token შენახულია recurring payment-ებისთვის: ${order_id}`,
            );
          } else {
            this.logger.log(
              `⚠️ Payment არ მოიძებნა orderId-ით: ${order_id}. შეიძლება ჯერ არ იყოს შენახული.`,
            );
          }
        } catch (error) {
          this.logger.error(
            '❌ Payment token-ის შენახვის შეცდომა:',
            error instanceof Error ? error.message : 'Unknown error',
          );
          // არ ვაბრუნებთ შეცდომას, რადგან callback-ი უნდა დასრულდეს წარმატებით
        }

        return {
          success: true,
          message: 'გადახდა წარმატებით დამუშავდა',
        };
      } else if (status === 'failed' || status === 'cancelled') {
        this.logger.log(`❌ BOG გადახდა წარუმატებელია: ${order_id}`);

        return {
          success: false,
          message: 'გადახდა წარუმატებელია',
        };
      } else {
        this.logger.log(`⏳ BOG გადახდა pending-შია: ${order_id}`);

        return {
          success: true,
          message: 'გადახდა pending-შია',
        };
      }
    } catch (error) {
      this.logger.error(
        '❌ BOG Callback დამუშავების შეცდომა:',
        (error as Error).message,
      );

      return {
        success: false,
        message: 'Callback დამუშავება ვერ მოხერხდა',
      };
    }
  }

  /**
   * BOG OAuth token cache-ის გასუფთავება (debug endpoint)
   * POST /bog/clear-token-cache
   */
  @Post('clear-token-cache')
  @HttpCode(HttpStatus.OK)
  clearTokenCache(): { success: boolean; message: string } {
    try {
      this.bogOAuthService.clearTokenCache();

      return {
        success: true,
        message: 'Token cache წარმატებით გასუფთავებულია',
      };
    } catch (error) {
      this.logger.error(
        '❌ BOG OAuth token cache-ის გასუფთავების შეცდომა:',
        (error as Error).message,
      );

      return {
        success: false,
        message: 'Token cache-ის გასუფთავება ვერ მოხერხდა',
      };
    }
  }

  /**
   * რეკურინგ გადახდის განხორციელება
   * POST /bog/recurring-payment
   *
   * გამოიყენება წარმატებული გადახდის order_id, რომელიც ინახება პირველი გადახდის შემდეგ
   *
   * @see https://api.bog.ge/docs/ipay/recurring-payments
   */
  @Post('recurring-payment')
  @HttpCode(HttpStatus.OK)
  async processRecurringPayment(
    @Body() recurringPaymentData: BOGRecurringPaymentDto,
  ): Promise<BOGRecurringPaymentResponseDto> {
    try {
      this.logger.log('🔄 რეკურინგ გადახდის მოთხოვნა მიღებულია', {
        order_id: recurringPaymentData.order_id,
        amount: recurringPaymentData.amount,
      });

      const result =
        await this.bogPaymentService.processRecurringPayment(
          recurringPaymentData,
        );

      this.logger.log(
        '✅ რეკურინგ გადახდა წარმატებით განხორციელდა:',
        result.order_id,
      );

      return result;
    } catch (error: any) {
      this.logger.error(
        '❌ რეკურინგ გადახდის შეცდომა:',
        (error as Error).message,
      );
      throw error;
    }
  }

  /**
   * Recurring payment token-ის მიღება (order_id) წარმატებული გადახდისგან
   * GET /bog/recurring-payment-token/:orderId
   *
   * ეს endpoint აბრუნებს order_id-ს, რომელიც გამოიყენება რეკურინგ გადახდებისთვის
   */
  @Get('recurring-payment-token/:orderId')
  async getRecurringPaymentToken(
    @Param('orderId') orderId: string,
  ): Promise<{ success: boolean; token?: string; message: string }> {
    try {
      this.logger.log(`🔍 Recurring payment token-ის მიღება: ${orderId}`);

      const token =
        await this.bogPaymentService.getRecurringPaymentToken(orderId);

      if (!token) {
        return {
          success: false,
          message:
            'Recurring payment token ვერ მოიძებნა. შეამოწმეთ რომ გადახდა წარმატებულია.',
        };
      }

      this.logger.log('✅ Recurring payment token მიღებულია');

      return {
        success: true,
        token,
        message: 'Recurring payment token წარმატებით მიღებულია',
      };
    } catch (error: any) {
      this.logger.error(
        '❌ Recurring payment token-ის მიღების შეცდომა:',
        (error as Error).message,
      );

      return {
        success: false,
        message: `Recurring payment token-ის მიღება ვერ მოხერხდა: ${(error as Error).message}`,
      };
    }
  }
}
