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

      // Logging: ვნახოთ რა იგზავნება BOG API-ში
      this.logger.log(
        '═══════════════════════════════════════════════════════',
      );
      this.logger.log('📤 BOG Order Request Data:');
      this.logger.log(
        '═══════════════════════════════════════════════════════',
      );
      this.logger.log(JSON.stringify(bogOrderData, null, 2));
      this.logger.log(
        '═══════════════════════════════════════════════════════',
      );
      this.logger.log(
        `💾 save_card: ${bogOrderData.save_card ? '✅ true' : '❌ false'}`,
      );
      this.logger.log(
        '═══════════════════════════════════════════════════════',
      );

      // Headers-ის მომზადება BOG API-ისთვის
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept-Language': orderData.accept_language || 'ka', // Default: ka
      };

      // Idempotency-Key (optional) - UUID v4
      if (orderData.idempotency_key) {
        headers['Idempotency-Key'] = orderData.idempotency_key;
      }

      // Theme (optional) - light | dark
      if (orderData.theme) {
        headers['Theme'] = orderData.theme;
      }

      // BOG API-ზე მოთხოვნის გაგზავნა
      const response = await fetch(
        `${this.BOG_API_BASE_URL}/ecommerce/orders`,
        {
          method: 'POST',
          headers,
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

      // ბარათის დამახსოვრება (თუ save_card არის true)
      // BOG API დოკუმენტაციის მიხედვით, ბარათის დამახსოვრება უნდა მოხდეს
      // შეკვეთის შექმნის შემდეგ, გადახდების გვერდზე მომხმარებლის გადამისამართებამდე
      if (orderData.save_card) {
        try {
          this.logger.log(
            `💾 ბარათის დამახსოვრება order_id: ${responseData.id}-ისთვის...`,
          );
          await this.saveCardForRecurringPayments(responseData.id);
          this.logger.log(
            `✅ ბარათი დამახსოვრებულია order_id: ${responseData.id}-ისთვის`,
          );
        } catch (saveCardError) {
          // ბარათის დამახსოვრების შეცდომა არ უნდა შეაჩეროს order-ის შექმნა
          // თუ order უკვე დამუშავებულია, ეს არ არის კრიტიკული შეცდომა
          this.logger.warn(
            `⚠️ ბარათის დამახსოვრება ვერ მოხერხდა, მაგრამ order შეიქმნა: ${
              saveCardError instanceof Error
                ? saveCardError.message
                : 'Unknown error'
            }`,
          );
        }
      }

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
   * BOG API დოკუმენტაციის შესაბამისად
   */
  private prepareBOGOrderData(
    orderData: BOGOrderRequestDto,
  ): Record<string, any> {
    const baseUrl = this.configService.get<string>('APP_BASE_URL') || '';

    // BOG API-ს სჭირდება HTTPS callback URL
    // Development-ში გამოვიყენოთ production URL ან environment variable
    let callbackUrl = orderData.callback_url;

    // თუ callback_url არის HTTP (development), გამოვიყენოთ production URL ან env variable
    if (callbackUrl && callbackUrl.startsWith('http://')) {
      // პირველ რიგში შევამოწმოთ BOG_CALLBACK_URL env variable
      let productionUrl = this.configService.get<string>('BOG_CALLBACK_URL');

      // თუ BOG_CALLBACK_URL არ არის, გამოვიყენოთ APP_BASE_URL (მაგრამ მხოლოდ თუ HTTPS-ია)
      if (!productionUrl) {
        const appBaseUrl = this.configService.get<string>('APP_BASE_URL');
        if (appBaseUrl && appBaseUrl.startsWith('https://')) {
          productionUrl = appBaseUrl;
        }
      }

      // თუ ჯერ კიდევ არ არის HTTPS URL, გამოვიყენოთ default production URL
      if (!productionUrl || productionUrl.startsWith('http://')) {
        productionUrl = 'https://marte-backend-production.up.railway.app';
      }

      // Replace HTTP URL with HTTPS production URL
      callbackUrl = callbackUrl.replace(/^http:\/\/[^/]+/, productionUrl);

      this.logger.warn(
        `⚠️ HTTP callback URL გადაკეთდა HTTPS-ზე: ${orderData.callback_url} → ${callbackUrl}`,
      );
    }

    // BOG API-ისთვის request body-ის მომზადება
    const requestBody: Record<string, any> = {};

    // application_type (optional)
    if (orderData.application_type) {
      requestBody.application_type = orderData.application_type;
    } else {
      // Default: mobile (CarApp არის მობილური აპლიკაცია)
      requestBody.application_type = 'mobile';
    }

    // buyer (optional)
    if (orderData.buyer) {
      const buyer: Record<string, string> = {};
      if (orderData.buyer.full_name) {
        buyer.full_name = orderData.buyer.full_name;
      }
      if (orderData.buyer.masked_email) {
        buyer.masked_email = orderData.buyer.masked_email;
      }
      if (orderData.buyer.masked_phone) {
        buyer.masked_phone = orderData.buyer.masked_phone;
      }
      requestBody.buyer = buyer;
    }

    // callback_url (required)
    requestBody.callback_url = callbackUrl;

    // external_order_id (optional)
    if (orderData.external_order_id) {
      requestBody.external_order_id = orderData.external_order_id;
    }

    // capture (optional)
    if (orderData.capture) {
      requestBody.capture = orderData.capture;
    }

    // purchase_units (required)
    if (orderData.purchase_units) {
      // თუ purchase_units გადმოცემულია, გამოვიყენოთ ის
      requestBody.purchase_units = {
        currency: orderData.purchase_units.currency || 'GEL',
        total_amount: orderData.purchase_units.total_amount,
        basket: orderData.purchase_units.basket.map((item) => ({
          product_id: item.product_id,
          ...(item.description && { description: item.description }),
          quantity: item.quantity,
          unit_price: item.unit_price,
          ...(item.unit_discount_price !== undefined && {
            unit_discount_price: item.unit_discount_price,
          }),
          ...(item.vat !== undefined && { vat: item.vat }),
          ...(item.vat_percent !== undefined && {
            vat_percent: item.vat_percent,
          }),
          ...(item.total_price !== undefined && {
            total_price: item.total_price,
          }),
          ...(item.image && { image: item.image }),
          ...(item.package_code && { package_code: item.package_code }),
          ...(item.tin && { tin: item.tin }),
          ...(item.pinfl && { pinfl: item.pinfl }),
          ...(item.product_discount_id && {
            product_discount_id: item.product_discount_id,
          }),
        })),
        ...(orderData.purchase_units.delivery && {
          delivery: {
            ...(orderData.purchase_units.delivery.amount !== undefined && {
              amount: orderData.purchase_units.delivery.amount,
            }),
          },
        }),
        ...(orderData.purchase_units.total_discount_amount !== undefined && {
          total_discount_amount: orderData.purchase_units.total_discount_amount,
        }),
      };
    } else {
      // Legacy: თუ purchase_units არ არის გადმოცემული, გამოვიყენოთ legacy fields
      if (!orderData.total_amount) {
        throw new Error(
          'total_amount ან purchase_units აუცილებელია BOG შეკვეთის შექმნისთვის',
        );
      }
      requestBody.purchase_units = {
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
      };
    }

    // redirect_urls (optional)
    if (orderData.redirect_urls) {
      const redirectUrls: Record<string, string> = {};
      if (orderData.redirect_urls.success) {
        redirectUrls.success = orderData.redirect_urls.success;
      }
      if (orderData.redirect_urls.fail) {
        redirectUrls.fail = orderData.redirect_urls.fail;
      }
      requestBody.redirect_urls = redirectUrls;
    } else if (orderData.success_url || orderData.fail_url) {
      // Legacy: თუ redirect_urls არ არის გადმოცემული, გამოვიყენოთ legacy fields
      const redirectUrls: Record<string, string> = {
        ...(orderData.success_url && { success: orderData.success_url }),
        ...(orderData.fail_url && { fail: orderData.fail_url }),
      };
      // თუ არც ერთი არ არის, დავამატოთ default values
      if (!redirectUrls.success) {
        redirectUrls.success = `${baseUrl}/payment/success`;
      }
      if (!redirectUrls.fail) {
        redirectUrls.fail = `${baseUrl}/payment/fail`;
      }
      requestBody.redirect_urls = redirectUrls;
    }

    // ttl (optional, default: 15 minutes)
    if (orderData.ttl !== undefined) {
      requestBody.ttl = orderData.ttl;
    } else {
      requestBody.ttl = 15; // Default: 15 წუთი
    }

    // payment_method (optional)
    if (orderData.payment_method && orderData.payment_method.length > 0) {
      requestBody.payment_method = orderData.payment_method;
    }

    // config (optional)
    if (orderData.config) {
      const config: Record<string, any> = {};
      if (orderData.config.loan) {
        const loan: Record<string, any> = {};
        if (orderData.config.loan.type) {
          loan.type = orderData.config.loan.type;
        }
        if (orderData.config.loan.month !== undefined) {
          loan.month = orderData.config.loan.month;
        }
        config.loan = loan;
      }
      if (orderData.config.campaign) {
        const campaign: Record<string, any> = {};
        if (orderData.config.campaign.card) {
          campaign.card = orderData.config.campaign.card;
        }
        if (orderData.config.campaign.type) {
          campaign.type = orderData.config.campaign.type;
        }
        config.campaign = campaign;
      }
      if (orderData.config.google_pay) {
        const googlePay: Record<string, any> = {};
        if (orderData.config.google_pay.google_pay_token) {
          googlePay.google_pay_token =
            orderData.config.google_pay.google_pay_token;
        }
        if (orderData.config.google_pay.external !== undefined) {
          googlePay.external = orderData.config.google_pay.external;
        }
        config.google_pay = googlePay;
      }
      if (orderData.config.apple_pay) {
        const applePay: Record<string, any> = {};
        if (orderData.config.apple_pay.external !== undefined) {
          applePay.external = orderData.config.apple_pay.external;
        }
        config.apple_pay = applePay;
      }
      if (orderData.config.account) {
        const account: Record<string, any> = {};
        if (orderData.config.account.tag) {
          account.tag = orderData.config.account.tag;
        }
        config.account = account;
      }
      requestBody.config = config;
    }

    // save_card არ არის BOG API-ში, მაგრამ გამოიყენება saveCardForRecurringPayments-ისთვის
    // ეს არ გადაეცემა BOG API-ში, მაგრამ შენახულია orderData-ში

    return requestBody;
  }

  /**
   * რეკურინგ გადახდის განხორციელება BOG API-ს გამოყენებით
   * გამოიყენება წარმატებული გადახდის parent_order_id, რომელზეც მოხდა ბარათის დამახსოვრება
   *
   * @see https://api.bog.ge/docs/payments/recurring-payments
   */
  async processRecurringPayment(
    recurringPaymentData: BOGRecurringPaymentDto,
  ): Promise<BOGRecurringPaymentResponseDto> {
    try {
      // parent_order_id-ის მიღება (legacy order_id-დან თუ არ არის parent_order_id)
      const parentOrderId =
        recurringPaymentData.parent_order_id ||
        recurringPaymentData.order_id ||
        '';

      if (!parentOrderId) {
        throw new HttpException(
          'parent_order_id აუცილებელია',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log('🔄 რეკურინგ გადახდის დაწყება...', {
        parent_order_id: parentOrderId,
        callback_url: recurringPaymentData.callback_url,
        external_order_id:
          recurringPaymentData.external_order_id ||
          recurringPaymentData.shop_order_id,
      });

      // OAuth Token-ის მიღება
      const token = await this.bogOAuthService.getAccessToken();
      if (!token) {
        throw new HttpException(
          'BOG OAuth token ვერ მოიძებნა',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // BOG API-ზე რეკურინგ გადახდის მოთხოვნა
      // Endpoint: POST /payments/v1/ecommerce/orders/:parent_order_id/subscribe
      // BOG API დოკუმენტაციის მიხედვით, body-ში optional-ია callback_url და external_order_id
      // სხვა პარამეტრები (თანხა, ვალუტა, მყიდველის ინფორმაცია) ავტომატურად იღება parent_order_id-დან
      const requestBody: {
        callback_url?: string;
        external_order_id?: string;
      } = {};

      if (recurringPaymentData.callback_url) {
        requestBody.callback_url = recurringPaymentData.callback_url;
      }

      if (
        recurringPaymentData.external_order_id ||
        recurringPaymentData.shop_order_id
      ) {
        requestBody.external_order_id =
          recurringPaymentData.external_order_id ||
          recurringPaymentData.shop_order_id;
      }

      const endpoint = `${this.BOG_API_BASE_URL}/ecommerce/orders/${parentOrderId}/subscribe`;

      this.logger.log(
        '═══════════════════════════════════════════════════════',
      );
      this.logger.log('📤 Sending recurring payment request to BOG API...');
      this.logger.log(
        '═══════════════════════════════════════════════════════',
      );
      this.logger.log(`   • Endpoint: ${endpoint}`);
      this.logger.log(`   • Method: POST`);
      this.logger.log(
        `   • Authorization: Bearer ${token.substring(0, 20)}...`,
      );
      this.logger.log(
        `   • Request Body: ${JSON.stringify(requestBody, null, 2)}`,
      );
      this.logger.log(
        '═══════════════════════════════════════════════════════',
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept-Language': 'ka',
        },
        body: JSON.stringify(requestBody),
      });

      this.logger.log(
        '═══════════════════════════════════════════════════════',
      );
      this.logger.log('📥 BOG API Response:');
      this.logger.log(
        '═══════════════════════════════════════════════════════',
      );
      this.logger.log(`   • Status: ${response.status} ${response.statusText}`);
      this.logger.log(`   • OK: ${response.ok}`);

      // ვამოწმებთ response-ის content type-ს
      const contentType = response.headers.get('content-type');
      this.logger.log(`   • Content-Type: ${contentType || 'N/A'}`);

      // ვალოგებთ headers-ებს
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      this.logger.log(
        `   • Response Headers: ${JSON.stringify(headers, null, 2)}`,
      );
      this.logger.log(
        '═══════════════════════════════════════════════════════',
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: { message?: string; error?: string; code?: string } = {};

        // თუ HTML response-ია, ვალოგებთ მხოლოდ პირველ 500 სიმბოლოს
        const isHtml =
          errorText.trim().startsWith('<!DOCTYPE') ||
          errorText.trim().startsWith('<html');
        const errorPreview = isHtml
          ? errorText.substring(0, 500) + (errorText.length > 500 ? '...' : '')
          : errorText;

        try {
          errorData = JSON.parse(errorText);
        } catch {
          // თუ JSON parse ვერ მოხერხდა, ვიყენებთ errorText-ს
          errorData = {
            message: isHtml
              ? `HTML response received (likely 404 or authentication error): ${response.status} ${response.statusText}`
              : errorText || 'Unknown error',
          };
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
        this.logger.error(`   • Content-Type: ${contentType || 'N/A'}`);
        this.logger.error(`   • Is HTML Response: ${isHtml ? 'Yes' : 'No'}`);
        this.logger.error(`   • Error Code: ${errorData.code || 'N/A'}`);
        this.logger.error(`   • Error Message: ${errorMessage}`);
        this.logger.error(`   • Response Preview: ${errorPreview}`);
        this.logger.error(
          '═══════════════════════════════════════════════════════',
        );

        throw new HttpException(
          `რეკურინგ გადახდა ვერ მოხერხდა: ${errorMessage}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // ვამოწმებთ რომ response არის JSON
      // BOG API შეიძლება დააბრუნოს application/json ან application/hal+json (HAL - Hypertext Application Language)
      const isJsonContentType =
        contentType &&
        (contentType.includes('application/json') ||
          contentType.includes('application/hal+json'));

      if (!isJsonContentType) {
        const responseText = await response.text();
        this.logger.error(
          `❌ Unexpected content type: ${contentType}. Response: ${responseText.substring(0, 500)}`,
        );
        throw new HttpException(
          `BOG API-მა დააბრუნა არასწორი content type: ${contentType}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      // BOG API დოკუმენტაციის მიხედვით, response არის:
      // { id: string, _links: { details: { href: string } } }
      const responseData = (await response.json()) as {
        id: string;
        _links?: {
          details?: {
            href?: string;
          };
        };
      };

      this.logger.log('✅ რეკურინგ გადახდა წარმატებით განხორციელდა:', {
        id: responseData.id,
        details_href: responseData._links?.details?.href,
      });

      // Response-ის ფორმატირება backward compatibility-ისთვის
      return {
        id: responseData.id,
        _links: responseData._links,
        // Legacy fields for backward compatibility
        order_id: responseData.id,
        status: 'success', // BOG API არ აბრუნებს status-ს, მაგრამ თუ წარმატებით დასრულდა, ეს success-ია
        message: 'რეკურინგ გადახდა წარმატებით განხორციელდა',
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
   * ბარათის დამახსოვრება ავტომატური გადახდებისთვის (subscription-ებისთვის)
   * PUT /payments/v1/orders/:order_id/subscriptions
   *
   * @param orderId - შეკვეთის ID რომელიც ბრუნდება create-order response-ში
   * @see https://api.bog.ge/docs/payments/saved-card/offline
   */
  async saveCardForRecurringPayments(orderId: string): Promise<void> {
    try {
      this.logger.log(
        `💾 ბარათის დამახსოვრება ავტომატური გადახდებისთვის order_id: ${orderId}-ისთვის...`,
      );

      // ვამოწმებთ order-ის სტატუსს დამახსოვრებამდე (optional)
      // BOG API დოკუმენტაციის მიხედვით, ბარათის დამახსოვრება უნდა მოხდეს
      // შეკვეთის შექმნის შემდეგ, გადახდების გვერდზე მომხმარებლის გადამისამართებამდე
      // ამ დროს order-ი შეიძლება pending-ში იყოს, რაც ნორმალურია
      try {
        const orderStatus = await this.getOrderStatus(orderId);
        this.logger.log(
          `🔍 Order სტატუსი: ${orderStatus.status} (${orderStatus.message})`,
        );

        // BOG API დოკუმენტაციის მიხედვით, ბარათის დამახსოვრება უნდა მოხდეს
        // შეკვეთის შექმნის შემდეგ, ამ დროს order-ი შეიძლება created, pending, completed ან success-ში იყოს
        // created status არის ნორმალური, რადგან order ახლახან შეიქმნა
        const allowedStatuses = ['created', 'pending', 'completed', 'success'];
        if (!allowedStatuses.includes(orderStatus.status)) {
          this.logger.warn(
            `⚠️ Order სტატუსი არ არის შესაფერისი ბარათის დამახსოვრებისთვის: ${orderStatus.status}`,
          );
          // არ ვაბრუნებთ შეცდომას, რადგან შეიძლება BOG API-მა მაინც მიიღოს მოთხოვნა
        } else {
          this.logger.log(
            `✅ Order სტატუსი შესაფერისია ბარათის დამახსოვრებისთვის: ${orderStatus.status}`,
          );
        }
      } catch (statusError) {
        // თუ სტატუსის შემოწმება ვერ მოხერხდა, ვაგრძელებთ მაინც
        // ეს არ არის კრიტიკული, რადგან BOG API-მა შეიძლება მაინც მიიღოს მოთხოვნა
        this.logger.warn(
          `⚠️ Order სტატუსის შემოწმება ვერ მოხერხდა, ვაგრძელებთ დამახსოვრებას: ${
            statusError instanceof Error ? statusError.message : 'Unknown error'
          }`,
        );
      }

      // OAuth Token-ის მიღება
      const token = await this.bogOAuthService.getAccessToken();
      if (!token) {
        throw new HttpException(
          'BOG OAuth token ვერ მოიძებნა',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // BOG API-ზე მოთხოვნის გაგზავნა
      // Endpoint: PUT /payments/v1/orders/:order_id/subscriptions
      // ეს endpoint გამოიყენება ავტომატური გადახდებისთვის (subscription-ებისთვის)
      const response = await fetch(
        `${this.BOG_API_BASE_URL}/orders/${orderId}/subscriptions`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Accept-Language': 'ka',
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: { message?: string; error?: string } = {};

        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = {
            message: errorText || `HTTP error! status: ${response.status}`,
          };
        }

        const errorMessage =
          errorData.message ||
          errorData.error ||
          `HTTP error! status: ${response.status}`;

        // თუ order უკვე დამუშავებულია, ეს არ არის კრიტიკული შეცდომა
        if (
          errorMessage.includes('already processed') ||
          errorMessage.includes('already exists') ||
          errorMessage.includes('duplicate')
        ) {
          this.logger.warn(
            `⚠️ Order უკვე დამუშავებულია, ბარათი შესაძლოა უკვე დამახსოვრებულია: ${errorMessage}`,
          );
          // არ ვაბრუნებთ შეცდომას, რადგან ეს არ არის კრიტიკული
          return;
        }

        this.logger.error(`❌ ბარათის დამახსოვრების შეცდომა: ${errorMessage}`);

        throw new HttpException(
          `ბარათის დამახსოვრება ვერ მოხერხდა: ${errorMessage}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // 202 ACCEPTED status code-ის შემოწმება
      if (response.status === 202) {
        this.logger.log(
          `✅ ბარათი წარმატებით დამახსოვრებულია ავტომატური გადახდებისთვის order_id: ${orderId}-ისთვის`,
        );
      } else {
        this.logger.warn(
          `⚠️ მოულოდნელი status code: ${response.status} order_id: ${orderId}-ისთვის (მოსალოდნელი იყო 202)`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        '❌ ბარათის დამახსოვრების შეცდომა:',
        error instanceof Error ? error.message : 'Unknown error',
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `ბარათის დამახსოვრება ვერ მოხერხდა: ${
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
