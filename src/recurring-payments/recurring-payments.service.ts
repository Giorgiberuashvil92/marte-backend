import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Subscription,
  SubscriptionDocument,
} from '../schemas/subscription.schema';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { BOGPaymentService } from '../bog/bog-payment.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class RecurringPaymentsService {
  private readonly logger = new Logger(RecurringPaymentsService.name);

  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Payment.name)
    private paymentModel: Model<PaymentDocument>,
    private bogPaymentService: BOGPaymentService,
    private paymentsService: PaymentsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, {
    name: 'process-recurring-payments',
    timeZone: 'Asia/Tbilisi',
  })
  async processRecurringPayments() {
    this.logger.log('🔄 რეკურინგ გადახდების დამუშავება დაწყებულია...');

    try {
      const now = new Date();

      // ვპოულობთ active subscription-ებს, რომელთა nextBillingDate დადგა
      const subscriptionsToCharge = await this.subscriptionModel
        .find({
          status: 'active',
          nextBillingDate: { $lte: now },
          bogCardToken: { $exists: true, $ne: null },
        })
        .exec();

      this.logger.log(
        `📊 ნაპოვნია ${subscriptionsToCharge.length} subscription რეკურინგ გადახდისთვის`,
      );

      let successCount = 0;
      let failureCount = 0;

      for (const subscription of subscriptionsToCharge) {
        try {
          await this.processSubscriptionPayment(subscription);
          successCount++;
        } catch (error: unknown) {
          const subscriptionId = String(subscription._id);
          this.logger.error(
            `❌ Subscription ${subscriptionId} გადახდის შეცდომა:`,
            error instanceof Error ? error.message : 'Unknown error',
          );
          failureCount++;

          // თუ გადახდა ვერ მოხერხდა, subscription-ს ვაყენებთ pending-ში
          await this.subscriptionModel.findByIdAndUpdate(subscriptionId, {
            status: 'pending',
            updatedAt: new Date(),
          });
        }
      }

      this.logger.log(
        `✅ რეკურინგ გადახდების დამუშავება დასრულდა: ${successCount} წარმატებული, ${failureCount} წარუმატებელი`,
      );
    } catch (error) {
      this.logger.error(
        '❌ რეკურინგ გადახდების დამუშავების შეცდომა:',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * ერთი subscription-ის გადახდის დამუშავება
   */
  private async processSubscriptionPayment(
    subscription: SubscriptionDocument,
  ): Promise<void> {
    const subscriptionId = String(subscription._id);
    this.logger.log(`💳 Subscription ${subscriptionId} გადახდის დამუშავება...`);

    if (!subscription.bogCardToken) {
      throw new Error('BOG payment token არ არის მოწოდებული');
    }

    // შევქმნათ ახალი order ID
    const shopOrderId = `recurring_${subscriptionId}_${Date.now()}`;

    // BOG recurring payment-ის განხორციელება
    const recurringPaymentResult =
      await this.bogPaymentService.processRecurringPayment({
        order_id: subscription.bogCardToken, // ეს არის წარმატებული გადახდის order_id
        amount: subscription.planPrice,
        currency: subscription.currency || 'GEL',
        shop_order_id: shopOrderId,
        purchase_description: `${subscription.planName} - ${subscription.period} subscription`,
      });

    if (recurringPaymentResult.status !== 'success') {
      throw new Error(
        `BOG recurring payment ვერ მოხერხდა: ${recurringPaymentResult.message}`,
      );
    }

    // გადახდის შენახვა database-ში (payments collection-ში)
    this.logger.log(
      '💾 Recurring payment-ის შენახვა payments collection-ში...',
    );
    const payment = await this.paymentsService.createPayment({
      userId: subscription.userId,
      orderId: recurringPaymentResult.order_id,
      amount: subscription.planPrice,
      currency: subscription.currency || 'GEL',
      paymentMethod: 'BOG',
      status: 'completed',
      context: 'subscription',
      description: `${subscription.planName} - ${subscription.period} subscription (Billing Cycle ${subscription.billingCycles + 1})`,
      paymentDate: new Date().toISOString(),
      isRecurring: true,
      recurringPaymentId: subscriptionId,
      metadata: {
        serviceName: `${subscription.planName} - ${subscription.period} subscription`,
      },
    });
    this.logger.log(
      `✅ Recurring payment შეინახა payments collection-ში: ${String(payment._id)}`,
    );

    // subscription-ის განახლება
    const nextBillingDate = this.calculateNextBillingDate(
      subscription.period,
      new Date(),
    );

    await this.subscriptionModel.findByIdAndUpdate(subscriptionId, {
      nextBillingDate,
      billingCycles: subscription.billingCycles + 1,
      totalPaid: subscription.totalPaid + subscription.planPrice,
      orderId: recurringPaymentResult.order_id,
      transactionId: recurringPaymentResult.order_id,
      updatedAt: new Date(),
    });

    this.logger.log(
      `✅ Subscription ${subscriptionId} გადახდა წარმატებით განხორციელდა. შემდეგი გადახდა: ${nextBillingDate.toISOString()}`,
    );
  }

  /**
   * შემდეგი billing date-ის გამოთვლა period-ის მიხედვით
   */
  private calculateNextBillingDate(period: string, currentDate: Date): Date {
    const nextDate = new Date(currentDate);

    switch (period) {
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      default:
        // default: monthly
        nextDate.setMonth(nextDate.getMonth() + 1);
    }

    return nextDate;
  }

  /**
   * Manual trigger რეკურინგ გადახდების დამუშავებისთვის (ტესტირებისთვის)
   */
  async processRecurringPaymentsManually(): Promise<{
    success: number;
    failed: number;
    total: number;
  }> {
    this.logger.log('🔄 Manual რეკურინგ გადახდების დამუშავება...');

    const now = new Date();
    this.logger.log(`📅 Current time: ${now.toISOString()}`);
    
    const subscriptionsToCharge = await this.subscriptionModel
      .find({
        status: 'active',
        nextBillingDate: { $lte: now },
        bogCardToken: { $exists: true, $ne: null },
      })
      .exec();
    
    this.logger.log(`📊 Found ${subscriptionsToCharge.length} subscriptions to charge`);
    if (subscriptionsToCharge.length > 0) {
      subscriptionsToCharge.forEach((sub) => {
        this.logger.log(`   • Subscription ID: ${String(sub._id)}`);
        this.logger.log(`   • User ID: ${sub.userId}`);
        this.logger.log(`   • Next Billing Date: ${sub.nextBillingDate?.toISOString()}`);
        this.logger.log(`   • BOG Token: ${sub.bogCardToken}`);
      });
    }

    let successCount = 0;
    let failureCount = 0;

    for (const subscription of subscriptionsToCharge) {
      try {
        await this.processSubscriptionPayment(subscription);
        successCount++;
      } catch (error: unknown) {
        const subscriptionId = String(subscription._id);
        this.logger.error(
          `❌ Subscription ${subscriptionId} გადახდის შეცდომა:`,
          error instanceof Error ? error.message : 'Unknown error',
        );
        failureCount++;
      }
    }

    return {
      success: successCount,
      failed: failureCount,
      total: subscriptionsToCharge.length,
    };
  }
}
