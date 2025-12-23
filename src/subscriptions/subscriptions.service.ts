import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subscription, SubscriptionDocument } from '../schemas/subscription.schema';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
  ) {}

  /**
   * ყველა subscription-ის მიღება
   */
  async getAllSubscriptions(): Promise<SubscriptionDocument[]> {
    try {
      this.logger.log('📊 Fetching all subscriptions');

      const subscriptions = await this.subscriptionModel
        .find()
        .sort({ createdAt: -1 })
        .exec();

      this.logger.log(`✅ Found ${subscriptions.length} subscriptions`);

      return subscriptions;
    } catch (error) {
      this.logger.error('❌ Failed to fetch subscriptions:', error);
      throw error;
    }
  }

  /**
   * Subscription-ის შექმნა payment-ის შემდეგ
   */
  async createSubscriptionFromPayment(
    userId: string,
    paymentToken: string,
    amount: number,
    currency: string = 'GEL',
    context: string = 'test',
  ): Promise<SubscriptionDocument> {
    try {
      this.logger.log('📝 Creating subscription from payment:', {
        userId,
        paymentToken,
        amount,
        currency,
        context,
      });

      // ვამოწმებთ არსებობს თუ არა subscription ამ user-ისთვის
      const existingSubscription = await this.subscriptionModel
        .findOne({ userId, status: 'active' })
        .exec();

      if (existingSubscription) {
        this.logger.log(
          `⚠️ Active subscription already exists for user ${userId}, updating...`,
        );
        // განვაახლოთ არსებული subscription
        existingSubscription.bogCardToken = paymentToken;
        existingSubscription.status = 'active';
        existingSubscription.nextBillingDate = this.calculateNextBillingDate(
          existingSubscription.period,
          new Date(),
        );
        existingSubscription.updatedAt = new Date();
        return await existingSubscription.save();
      }

      // შევქმნათ ახალი subscription
      const subscriptionData = {
        userId,
        planId: context === 'test' ? 'test_plan' : 'subscription_plan',
        planName: context === 'test' ? 'ტესტ საბსქრიფშენი' : 'პრემიუმ საბსქრიფშენი',
        planPrice: amount,
        currency,
        period: 'monthly', // default: monthly
        status: 'active',
        startDate: new Date(),
        nextBillingDate: this.calculateNextBillingDate('monthly', new Date()),
        paymentMethod: 'BOG',
        bogCardToken: paymentToken,
        totalPaid: amount,
        billingCycles: 1,
      };

      const subscription = new this.subscriptionModel(subscriptionData);
      const savedSubscription = await subscription.save();

      this.logger.log(
        `✅ Subscription created successfully: ${String(savedSubscription._id)}`,
      );

      return savedSubscription;
    } catch (error) {
      this.logger.error('❌ Failed to create subscription:', error);
      throw error;
    }
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
        nextDate.setMonth(nextDate.getMonth() + 1);
    }

    return nextDate;
  }
}

