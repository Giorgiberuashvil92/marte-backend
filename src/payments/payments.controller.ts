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

@Controller('api/payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

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
}
