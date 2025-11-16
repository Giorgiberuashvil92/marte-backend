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
import { BOGPaymentService } from './bog-payment.service';
import { BOGOAuthService } from './bog-oauth.service';
import {
  BOGOrderRequestDto,
  BOGOrderResponseDto,
  BOGPaymentStatusDto,
} from './dto/bog-payment.dto';

@Controller('bog')
export class BOGController {
  private readonly logger = new Logger(BOGController.name);

  constructor(
    private readonly bogPaymentService: BOGPaymentService,
    private readonly bogOAuthService: BOGOAuthService,
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
  handleBOGCallback(
    @Body() callbackData: any,
    @Headers() headers: Record<string, any>,
  ): { success: boolean; message: string } {
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

        // აქ შეგიძლიათ დაუმატოთ:
        // - გადახდის მონაცემების ბაზაში შენახვა
        // - მომხმარებელს შეტყობინების გაგზავნა
        // - შეკვეთის სტატუსის განახლება
        // - CarWash booking-ის დადასტურება

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
}
