import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BOGOAuthService } from './bog-oauth.service';
import {
  BOGOrderRequestDto,
  BOGOrderResponseDto,
  BOGPaymentStatusDto,
  BOGRecurringPaymentDto,
  BOGRecurringPaymentResponseDto,
} from './dto/bog-payment.dto';

// BOG API Response Types
interface BOGOrderApiResponse {
  id: string;
  _links: {
    details: { href: string };
    redirect: { href: string };
  };
}

interface BOGStatusApiResponse {
  order_id: string;
  order_status: {
    key: string;
    value: string;
  };
  payment_detail?: {
    code: string;
    code_description: string;
    transaction_id?: string;
  };
  reject_reason?: string;
}

@Injectable()
export class BOGPaymentService {
  private readonly logger = new Logger(BOGPaymentService.name);
  private readonly BOG_API_BASE_URL = 'https://api.bog.ge/payments/v1'; // OAuth და ecommerce endpoints
  private readonly BOG_IPAY_BASE_URL = 'https://ipay.ge/opay/api/v1'; // iPay API base URL (recurring payments-ისთვის)

  constructor(
    private bogOAuthService: BOGOAuthService,
    private configService: ConfigService,
  ) {
    this.logger.log('✅ BOG Payment Service ინიციალიზებულია');
  }

  /**
   * BOG-ში შეკვეთის შექმნა
   */
  async createOrder(
    orderData: BOGOrderRequestDto,
  ): Promise<BOGOrderResponseDto> {
    try {
      this.logger.log('🔄 BOG შეკვეთის შექმნა...');

      // OAuth Token-ის მიღება
      const token = await this.bogOAuthService.getAccessToken();
      if (!token) {
        throw new HttpException(
          'BOG OAuth token ვერ მოიძებნა',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // BOG API-ისთვის მონაცემების მომზადება
      const bogOrderData = this.prepareBOGOrderData(orderData);

      // BOG API-ზე მოთხოვნის გაგზავნა
      const response = await fetch(
        `${this.BOG_API_BASE_URL}/ecommerce/orders`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept-Language': 'ka',
          },
          body: JSON.stringify(bogOrderData),
        },
      );

      if (!response.ok) {
        const errorData = (await response.json()) as { message: string };
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`,
        );
      }

      const responseData = (await response.json()) as BOGOrderApiResponse;

      this.logger.log('✅ BOG შეკვეთა წარმატებით შეიქმნა:', responseData.id);

      // Response-ის ფორმატირება
      return {
        id: responseData.id,
        redirect_url: responseData._links.redirect.href,
      };
    } catch (error: any) {
      this.logger.error(
        '❌ BOG შეკვეთის შექმნის შეცდომა:',
        (error as Error).message || 'Unknown error',
      );

      throw new HttpException(
        `BOG შეკვეთის შექმნა ვერ მოხერხდა: ${(error as Error).message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * BOG შეკვეთის სტატუსის შემოწმება
   */
  async getOrderStatus(orderId: string): Promise<BOGPaymentStatusDto> {
    try {
      this.logger.log(`🔍 BOG შეკვეთის სტატუსის შემოწმება: ${orderId}`);

      // OAuth Token-ის მიღება
      const token = await this.bogOAuthService.getAccessToken();
      if (!token) {
        throw new HttpException(
          'BOG OAuth token ვერ მოიძებნა',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // BOG API-ზე მოთხოვნის გაგზავნა
      const response = await fetch(
        `${this.BOG_API_BASE_URL}/receipt/${orderId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Accept-Language': 'ka',
          },
        },
      );

      if (!response.ok) {
        const errorData = (await response.json()) as { message: string };
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`,
        );
      }

      const responseData = (await response.json()) as BOGStatusApiResponse;

      this.logger.log('✅ BOG შეკვეთის სტატუსი მიღებულია:', responseData);

      return {
        order_id: orderId,
        status: responseData.order_status.key || 'pending',
        message: responseData.order_status.value || 'სტატუსი მიღებულია',
      };
    } catch (error: any) {
      this.logger.error(
        '❌ BOG შეკვეთის სტატუსის შემოწმების შეცდომა:',
        (error as Error).message || 'Unknown error',
      );

      throw new HttpException(
        `BOG შეკვეთის სტატუსის შემოწმება ვერ მოხერხდა: ${(error as Error).message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * BOG გადახდის სრული დეტალების მიღება
   */
  async getPaymentDetails(orderId: string): Promise<any> {
    try {
      this.logger.log(`🔍 BOG გადახდის დეტალების მიღება: ${orderId}`);

      // OAuth Token-ის მიღება
      const token = await this.bogOAuthService.getAccessToken();
      if (!token) {
        throw new HttpException(
          'BOG OAuth token ვერ მოიძებნა',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // BOG API-ზე მოთხოვნის გაგზავნა
      const response = await fetch(
        `${this.BOG_API_BASE_URL}/receipt/${orderId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Accept-Language': 'ka',
          },
        },
      );

      if (!response.ok) {
        const errorData = (await response.json()) as { message: string };
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`,
        );
      }

      const responseData = (await response.json()) as BOGStatusApiResponse;
      this.logger.log('✅ BOG გადახდის დეტალები მიღებულია:', responseData);

      return responseData;
    } catch (error: any) {
      this.logger.error(
        '❌ BOG გადახდის დეტალების მიღების შეცდომა:',
        (error as Error).message || 'Unknown error',
      );

      throw new HttpException(
        `BOG გადახდის დეტალების მიღება ვერ მოხერხდა: ${(error as Error).message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * CarApp-ის მონაცემების BOG API ფორმატში გადაყვანა
   */
  private prepareBOGOrderData(
    orderData: BOGOrderRequestDto,
  ): Record<string, any> {
    const baseUrl = this.configService.get<string>('APP_BASE_URL') || '';

    return {
      application_type: 'mobile',
      callback_url: orderData.callback_url,
      external_order_id: orderData.external_order_id,
      purchase_units: {
        currency: orderData.currency || 'GEL',
        total_amount: orderData.total_amount,
        basket: [
          {
            product_id: orderData.product_id || 'carapp_service',
            description: orderData.description || 'CarApp სერვისი',
            quantity: 1,
            unit_price: orderData.total_amount,
          },
        ],
      },
      redirect_urls: {
        success: orderData.success_url || `${baseUrl}/payment/success`,
        fail: orderData.fail_url || `${baseUrl}/payment/fail`,
      },
      ttl: 15, // 15 წუთი
      save_card: true, // ✅ Card token-ის შენახვა recurring payment-ებისთვის
    };
  }

  /**
   * რეკურინგ გადახდის განხორციელება BOG iPay API-ს გამოყენებით
   * გამოიყენება წარმატებული გადახდის order_id, რომელიც გამოიყენება რეკურინგ გადახდებისთვის
   *
   * @see https://api.bog.ge/docs/ipay/recurring-payments
   */
  async processRecurringPayment(
    recurringPaymentData: BOGRecurringPaymentDto,
  ): Promise<BOGRecurringPaymentResponseDto> {
    try {
      this.logger.log('🔄 რეკურინგ გადახდის დაწყება...', {
        order_id: recurringPaymentData.order_id,
        amount: recurringPaymentData.amount,
        shop_order_id: recurringPaymentData.shop_order_id,
      });

      // OAuth Token-ის მიღება
      const token = await this.bogOAuthService.getAccessToken();
      if (!token) {
        throw new HttpException(
          'BOG OAuth token ვერ მოიძებნა',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // BOG iPay API-ზე რეკურინგ გადახდის მოთხოვნა
      // Endpoint: POST /opay/api/v1/checkout/payment/subscription
      // Base URL: https://ipay.ge/opay/api/v1 (documentation-ის მიხედვით)
      // Recurring payment-ისთვის საჭიროა წარმატებული გადახდის order_id
      const requestBody = {
        order_id: recurringPaymentData.order_id, // წარმატებული გადახდის order_id რომელიც გამოიყენება როგორც token
        amount: {
          currency_code: recurringPaymentData.currency || 'GEL',
          value: recurringPaymentData.amount.toString(),
        },
        shop_order_id: recurringPaymentData.shop_order_id,
        purchase_description: recurringPaymentData.purchase_description,
      };

      this.logger.log(
        '📤 Sending recurring payment request to BOG iPay API...',
      );
      this.logger.log(
        `   • Endpoint: ${this.BOG_IPAY_BASE_URL}/checkout/payment/subscription`,
      );
      this.logger.log(`   • Request Body: ${JSON.stringify(requestBody, null, 2)}`);

      const response = await fetch(
        `${this.BOG_IPAY_BASE_URL}/checkout/payment/subscription`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept-Language': 'ka',
          },
          body: JSON.stringify(requestBody),
        },
      );

      this.logger.log(
        `📥 BOG API Response Status: ${response.status} ${response.statusText}`,
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: { message?: string; error?: string; code?: string } = {};

        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || 'Unknown error' };
        }

        const errorMessage =
          errorData.message ||
          errorData.error ||
          errorData.code ||
          'Unknown error';

        this.logger.error(
          '═══════════════════════════════════════════════════════',
        );
        this.logger.error('❌ BOG Recurring Payment Error:');
        this.logger.error(
          '═══════════════════════════════════════════════════════',
        );
        this.logger.error(
          `   • Status: ${response.status} ${response.statusText}`,
        );
        this.logger.error(`   • Error Code: ${errorData.code || 'N/A'}`);
        this.logger.error(`   • Error Message: ${errorMessage}`);
        this.logger.error(`   • Full Response: ${errorText.substring(0, 500)}`);
        this.logger.error(
          '═══════════════════════════════════════════════════════',
        );

        throw new HttpException(
          `რეკურინგ გადახდა ვერ მოხერხდა: ${errorMessage}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const responseData = (await response.json()) as {
        order_id: string;
        status: string;
        message?: string;
      };

      this.logger.log('✅ რეკურინგ გადახდა წარმატებით განხორციელდა:', {
        order_id: responseData.order_id,
        status: responseData.status,
      });

      return {
        order_id: responseData.order_id,
        status: responseData.status,
        message:
          responseData.message || 'რეკურინგ გადახდა წარმატებით განხორციელდა',
      };
    } catch (error: unknown) {
      this.logger.error(
        '❌ რეკურინგ გადახდის შეცდომა:',
        error instanceof Error ? error.message : 'Unknown error',
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `რეკურინგ გადახდა ვერ მოხერხდა: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Payment token-ის მიღება გადახდის დეტალებიდან
   * BOG iPay API-ში, რეკურინგ გადახდებისთვის გამოიყენება წარმატებული გადახდის order_id
   * ეს order_id ინახება პირველი გადახდის შემდეგ და გამოიყენება რეკურინგ გადახდებისთვის
   *
   * @param orderId - წარმატებული გადახდის order_id
   * @returns order_id რომელიც გამოიყენება რეკურინგ გადახდებისთვის
   */
  async getRecurringPaymentToken(orderId: string): Promise<string | null> {
    try {
      this.logger.log(
        `🔍 Recurring payment token-ის მიღება orderId-დან: ${orderId}`,
      );

      // ვამოწმებთ რომ გადახდა წარმატებულია
      const paymentStatus = await this.getOrderStatus(orderId);

      if (
        paymentStatus.status !== 'completed' &&
        paymentStatus.status !== 'success'
      ) {
        this.logger.warn(
          `⚠️ გადახდა არ არის წარმატებული: ${paymentStatus.status}`,
        );
        return null;
      }

      // BOG iPay API-ში, რეკურინგ გადახდებისთვის გამოიყენება წარმატებული გადახდის order_id
      // ეს order_id არის "payment token" რეკურინგ გადახდებისთვის
      this.logger.log('✅ Recurring payment token (order_id) მიღებულია');
      return orderId;
    } catch (error: unknown) {
      this.logger.error(
        '❌ Recurring payment token-ის მიღების შეცდომა:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return null;
    }
  }
}
