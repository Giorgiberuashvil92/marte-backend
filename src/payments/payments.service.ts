import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Payment, PaymentDocument } from '../schemas/payment.schema';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
  ) {}

  async createPayment(
    createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentDocument> {
    try {
      this.logger.log('💾 Creating payment in database:', {
        userId: createPaymentDto.userId,
        amount: createPaymentDto.amount,
        orderId: createPaymentDto.orderId,
      });

      const payment = new this.paymentModel({
        ...createPaymentDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const savedPayment = await payment.save();

      this.logger.log('✅ Payment saved to database:', {
        paymentId: savedPayment._id,
        userId: savedPayment.userId,
        amount: savedPayment.amount,
      });

      return savedPayment;
    } catch (error: unknown) {
      this.logger.error('❌ Failed to save payment to database:', error);
      throw new Error(
        `Failed to save payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getUserPayments(userId: string): Promise<PaymentDocument[]> {
    try {
      this.logger.log(`📊 Retrieving payments for user: ${userId}`);

      const payments = await this.paymentModel
        .find({ userId })
        .sort({ paymentDate: -1 })
        .exec();

      this.logger.log(
        `✅ Found ${payments.length} payments for user ${userId}`,
      );

      return payments;
    } catch (error: unknown) {
      this.logger.error('❌ Failed to get user payments:', error);
      throw new Error(
        `Failed to get user payments: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getPaymentStats() {
    try {
      this.logger.log('📈 Calculating payment statistics');

      const totalPayments = await this.paymentModel.countDocuments();
      const totalAmount = await this.paymentModel.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);

      const paymentsByMethod = await this.paymentModel.aggregate([
        {
          $group: {
            _id: '$paymentMethod',
            count: { $sum: 1 },
            total: { $sum: '$amount' },
          },
        },
      ]);

      const paymentsByContext = await this.paymentModel.aggregate([
        {
          $group: {
            _id: '$context',
            count: { $sum: 1 },
            total: { $sum: '$amount' },
          },
        },
      ]);

      const recentPayments = await this.paymentModel
        .find()
        .sort({ paymentDate: -1 })
        .limit(10)
        .exec();

      const stats = {
        totalPayments,
        totalAmount: (totalAmount[0] as { total?: number })?.total || 0,
        paymentsByMethod,
        paymentsByContext,
        recentPayments,
      };

      this.logger.log('✅ Payment statistics calculated successfully');

      return stats;
    } catch (error: unknown) {
      this.logger.error('❌ Failed to calculate payment statistics:', error);
      throw new Error(
        `Failed to calculate payment statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getPaymentById(paymentId: string): Promise<PaymentDocument> {
    try {
      this.logger.log(`🔍 Getting payment by ID: ${paymentId}`);

      const payment = await this.paymentModel.findById(paymentId).exec();

      if (!payment) {
        throw new Error('Payment not found');
      }

      this.logger.log(`✅ Payment found: ${paymentId}`);

      return payment;
    } catch (error: unknown) {
      this.logger.error('❌ Failed to get payment by ID:', error);
      throw new Error(
        `Failed to get payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async savePaymentToken(
    orderId: string,
    paymentToken: string,
  ): Promise<PaymentDocument> {
    try {
      this.logger.log(`💾 Saving payment token for order: ${orderId}`);

      const payment = await this.paymentModel
        .findOneAndUpdate(
          { orderId },
          {
            paymentToken,
            updatedAt: new Date(),
          },
          { new: true },
        )
        .exec();

      if (!payment) {
        throw new Error(`Payment with orderId ${orderId} not found`);
      }

      this.logger.log(`✅ Payment token saved for order: ${orderId}`);

      return payment;
    } catch (error: unknown) {
      this.logger.error('❌ Failed to save payment token:', error);
      throw new Error(
        `Failed to save payment token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getPaymentByOrderId(orderId: string): Promise<PaymentDocument | null> {
    try {
      this.logger.log(`🔍 Getting payment by orderId: ${orderId}`);

      const payment = await this.paymentModel.findOne({ orderId }).exec();

      if (payment) {
        this.logger.log(`✅ Payment found for orderId: ${orderId}`);
      } else {
        this.logger.log(`⚠️ Payment not found for orderId: ${orderId}`);
      }

      return payment;
    } catch (error: unknown) {
      this.logger.error('❌ Failed to get payment by orderId:', error);
      throw new Error(
        `Failed to get payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getUserPaymentToken(userId: string): Promise<string | null> {
    try {
      this.logger.log(`🔍 Getting payment token for user: ${userId}`);

      // ვპოულობთ ბოლო წარმატებულ გადახდას ამ მომხმარებლისთვის, რომელსაც აქვს paymentToken
      const payment = await this.paymentModel
        .findOne({
          userId,
          status: 'completed',
          paymentToken: { $exists: true, $ne: null },
        })
        .sort({ paymentDate: -1 })
        .exec();

      if (payment && payment.paymentToken) {
        this.logger.log(`✅ Payment token found for user: ${userId}`);
        return payment.paymentToken;
      }

      this.logger.log(`⚠️ Payment token not found for user: ${userId}`);
      return null;
    } catch (error: unknown) {
      this.logger.error('❌ Failed to get user payment token:', error);
      throw new Error(
        `Failed to get payment token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
