import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Subscription,
  SubscriptionDocument,
} from '../schemas/subscription.schema';

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
   * User-ის active subscription-ის მიღება
   */
  async getUserSubscription(
    userId: string,
  ): Promise<SubscriptionDocument | null> {
    try {
      this.logger.log(`📊 Fetching subscription for user: ${userId}`);

      const subscription = await this.subscriptionModel
        .findOne({ userId, status: 'active' })
        .sort({ createdAt: -1 })
        .exec();

      if (subscription) {
        this.logger.log(`✅ Found active subscription for user ${userId}`);
      } else {
        this.logger.log(`⚠️ No active subscription found for user ${userId}`);
      }

      return subscription;
    } catch (error) {
      this.logger.error('❌ Failed to fetch user subscription:', error);
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
    planId?: string,
    planName?: string,
    planPeriod?: string,
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

      // Plan ID და Plan Name-ის განსაზღვრა
      // თუ planId და planName გადაეცა, გამოვიყენოთ ისინი
      // თუ არა, გამოვიყენოთ context-ის მიხედვით default მნიშვნელობები
      let finalPlanId = planId;
      let finalPlanName = planName;

      if (!finalPlanId) {
        // Plan ID-ის mapping frontend-ის planId-დან
        if (context === 'test' || context === 'test_subscription') {
          finalPlanId = 'test_plan';
        } else if (context.includes('basic')) {
          finalPlanId = 'basic';
        } else if (context.includes('premium')) {
          finalPlanId = 'premium';
        } else {
          finalPlanId = 'subscription_plan';
        }
      }

      if (!finalPlanName) {
        // Plan Name-ის default მნიშვნელობები
        if (context === 'test' || context === 'test_subscription') {
          finalPlanName = 'ტესტ საბსქრიფშენი';
        } else if (finalPlanId === 'basic') {
          finalPlanName = 'ძირითადი პაკეტი';
        } else if (finalPlanId === 'premium') {
          finalPlanName = 'პრემიუმ პაკეტი';
        } else {
          finalPlanName = 'პრემიუმ საბსქრიფშენი';
        }
      }

      // Period-ის განსაზღვრა planPeriod-დან
      let period = 'monthly'; // default
      if (planPeriod) {
        if (planPeriod.includes('თვეში') || planPeriod === 'monthly') {
          period = 'monthly';
        } else if (planPeriod.includes('წლ') || planPeriod === 'yearly') {
          period = 'yearly';
        } else if (planPeriod.includes('6') || planPeriod.includes('6-month')) {
          period = 'monthly'; // 6 თვე ასევე monthly-ს განვიხილავთ, მაგრამ nextBillingDate 6 თვეში იქნება
        } else {
          period = 'monthly';
        }
      }

      // შევქმნათ ახალი subscription
      const subscriptionData = {
        userId,
        planId: finalPlanId,
        planName: finalPlanName,
        planPrice: amount,
        currency,
        period: period,
        status: 'active',
        startDate: new Date(),
        nextBillingDate: this.calculateNextBillingDate(period, new Date()),
        paymentMethod: 'BOG',
        bogCardToken: paymentToken, // ეს არის create-order response-ის order_id (parent order_id)
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
