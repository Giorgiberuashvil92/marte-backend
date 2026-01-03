import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller('api/payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    try {
      this.logger.log('💳 Payment creation request received:', {
        userId: createPaymentDto.userId,
        amount: createPaymentDto.amount,
        context: createPaymentDto.context,
        orderId: createPaymentDto.orderId,
      });

      const payment =
        await this.paymentsService.createPayment(createPaymentDto);

      this.logger.log('✅ Payment created successfully:', {
        paymentId: payment.id,
        userId: payment.userId,
        amount: payment.amount,
      });

      return {
        success: true,
        message: 'Payment saved successfully',
        data: payment,
      };
    } catch (error) {
      this.logger.error('❌ Payment creation failed:', error);
      return {
        success: false,
        message: 'Failed to save payment',
        error: error.message,
      };
    }
  }

  @Get('user/:userId')
  async getUserPayments(@Param('userId') userId: string) {
    try {
      this.logger.log(`📊 Getting payments for user: ${userId}`);

      const payments = await this.paymentsService.getUserPayments(userId);

      this.logger.log(
        `✅ Found ${payments.length} payments for user ${userId}`,
      );

      return {
        success: true,
        message: 'User payments retrieved successfully',
        data: payments,
      };
    } catch (error) {
      this.logger.error('❌ Failed to get user payments:', error);
      return {
        success: false,
        message: 'Failed to retrieve user payments',
        error: error.message,
      };
    }
  }

  /**
   * Payment-ის მიღება Order ID-ით
   * GET /api/payments/order/:orderId
   */
  @Get('order/:orderId')
  async getPaymentByOrderId(@Param('orderId') orderId: string) {
    try {
      this.logger.log(`🔍 Getting payment by orderId: ${orderId}`);

      const payment = await this.paymentsService.getPaymentByOrderId(orderId);

      if (!payment) {
        this.logger.log(`⚠️ Payment not found for orderId: ${orderId}`);
        return {
          success: false,
          message: 'Payment not found',
          data: null,
        };
      }

      this.logger.log(`✅ Payment found: ${String(payment._id)}`);

      return {
        success: true,
        message: 'Payment retrieved successfully',
        data: payment,
      };
    } catch (error) {
      this.logger.error('❌ Failed to get payment by orderId:', error);
      return {
        success: false,
        message: 'Failed to retrieve payment',
        error: error.message,
      };
    }
  }

  @Get('stats')
  async getPaymentStats() {
    try {
      this.logger.log('📈 Getting payment statistics');

      const stats = await this.paymentsService.getPaymentStats();

      this.logger.log('✅ Payment statistics retrieved successfully');

      return {
        success: true,
        message: 'Payment statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      this.logger.error('❌ Failed to get payment statistics:', error);
      return {
        success: false,
        message: 'Failed to retrieve payment statistics',
        error: error.message,
      };
    }
  }

  /**
   * Payment token-ის შენახვა orderId-სთვის
   * POST /api/payments/save-token
   */
  @Post('save-token')
  @HttpCode(HttpStatus.OK)
  async savePaymentToken(
    @Body() body: { orderId: string; paymentToken: string },
  ) {
    try {
      this.logger.log('💾 Saving payment token:', {
        orderId: body.orderId,
      });

      const payment = await this.paymentsService.savePaymentToken(
        body.orderId,
        body.paymentToken,
      );

      this.logger.log('✅ Payment token saved successfully');

      return {
        success: true,
        message: 'Payment token saved successfully',
        data: payment,
      };
    } catch (error) {
      this.logger.error('❌ Failed to save payment token:', error);
      return {
        success: false,
        message: 'Failed to save payment token',
        error: error.message,
      };
    }
  }

  /**
   * User-ის payment token-ის მიღება
   * GET /api/payments/user/:userId/token
   */
  @Get('user/:userId/token')
  async getUserPaymentToken(@Param('userId') userId: string) {
    try {
      this.logger.log(`🔍 Getting payment token for user: ${userId}`);

      const token = await this.paymentsService.getUserPaymentToken(userId);

      if (!token) {
        return {
          success: false,
          message: 'Payment token not found for this user',
          data: null,
        };
      }

      this.logger.log('✅ Payment token retrieved successfully');

      return {
        success: true,
        message: 'Payment token retrieved successfully',
        data: { paymentToken: token },
      };
    } catch (error) {
      this.logger.error('❌ Failed to get user payment token:', error);
      return {
        success: false,
        message: 'Failed to retrieve payment token',
        error: error.message,
      };
    }
  }

  /**
   * User-ის subscription status-ის მიღება
   * GET /api/payments/subscription/user/:userId/status
   */
  @Get('subscription/user/:userId/status')
  async getUserSubscriptionStatus(@Param('userId') userId: string) {
    try {
      this.logger.log(`📊 Getting subscription status for user: ${userId}`);

      const subscription = await this.subscriptionsService.getUserSubscription(userId);

      if (!subscription) {
        this.logger.log(`⚠️ No active subscription found for user ${userId}`);
        return {
          success: false,
          message: 'No active subscription found',
          data: null,
        };
      }

      this.logger.log(`✅ Subscription found for user ${userId}`);

      return {
        success: true,
        message: 'Subscription retrieved successfully',
        data: subscription,
      };
    } catch (error) {
      this.logger.error('❌ Failed to get user subscription status:', error);
      return {
        success: false,
        message: 'Failed to retrieve subscription status',
        error: error.message,
      };
    }
  }
}
