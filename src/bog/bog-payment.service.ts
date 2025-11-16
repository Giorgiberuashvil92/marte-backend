import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BOGOAuthService } from './bog-oauth.service';
import {
  BOGOrderRequestDto,
  BOGOrderResponseDto,
  BOGPaymentStatusDto,
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
  private readonly BOG_API_BASE_URL = 'https://api.bog.ge/payments/v1';

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
    };
  }
}
