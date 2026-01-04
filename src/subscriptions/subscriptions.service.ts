import { Injectable, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import {
  Subscription,
  SubscriptionDocument,
} from '../schemas/subscription.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectConnection()
    private connection: Connection,
    private notificationsService: NotificationsService,
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

        // შევამოწმოთ არის თუ არა ახალი billing period (თუ nextBillingDate გავიდა)
        const now = new Date();
        const isNewBillingPeriod =
          existingSubscription.nextBillingDate &&
          new Date(existingSubscription.nextBillingDate) < now;

        // განვაახლოთ არსებული subscription
        existingSubscription.bogCardToken = paymentToken;
        existingSubscription.status = 'active';
        existingSubscription.nextBillingDate = this.calculateNextBillingDate(
          existingSubscription.period,
          new Date(),
        );

        // თუ ახალი billing period იწყება, reset-ი გავაკეთოთ CarFAX counter-ს
        if (isNewBillingPeriod) {
          this.logger.log(
            `🔄 New billing period detected for user ${userId}, resetting CarFAX counter`,
          );
          existingSubscription.carfaxRequestsUsed = 0;
        }

        existingSubscription.updatedAt = new Date();
        const updatedSubscription = await existingSubscription.save();

        // გავაგზავნოთ push notification user-ისთვის subscription-ის განახლების შესახებ
        try {
          await this.notificationsService.sendPushToUsers(
            [userId],
            {
              title: '🔄 საბსქრიფშენი განახლებულია!',
              body: `თქვენი ${existingSubscription.planName} საბსქრიფშენი წარმატებით განახლდა.`,
              data: {
                type: 'subscription_updated',
                subscriptionId: String(updatedSubscription._id),
                planId: existingSubscription.planId,
                planName: existingSubscription.planName,
                screen: 'Subscription',
              },
              sound: 'default',
              badge: 1,
            },
            'system',
          );
          this.logger.log(
            `✅ Push notification sent to user: ${userId} for subscription update`,
          );
        } catch (notificationError) {
          this.logger.error(
            `⚠️ Failed to send push notification for subscription update:`,
            notificationError,
          );
          // არ ვაგდებთ error-ს, რადგან subscription უკვე განახლდა
        }

        return updatedSubscription;
      }

      // Plan ID და Plan Name-ის განსაზღვრა
      // თუ planId და planName გადაეცა, გამოვიყენოთ ისინი
      // თუ არა, გამოვიყენოთ context-ის მიხედვით default მნიშვნელობები
      this.logger.log('🔍 Plan ID და Plan Name-ის განსაზღვრა:');
      this.logger.log(`   • Received planId: ${planId || 'NOT PROVIDED'}`);
      this.logger.log(`   • Received planName: ${planName || 'NOT PROVIDED'}`);
      this.logger.log(`   • Context: ${context}`);

      let finalPlanId = planId;
      let finalPlanName = planName;

      if (!finalPlanId) {
        this.logger.warn(
          '⚠️ planId არ გადაეცა! გამოვიყენებთ context-ის მიხედვით default მნიშვნელობას',
        );
        // Plan ID-ის mapping frontend-ის planId-დან
        if (context === 'test' || context === 'test_subscription') {
          finalPlanId = 'test_plan';
          this.logger.log('   → Setting planId to: test_plan (from context)');
        } else if (context.includes('basic')) {
          finalPlanId = 'basic';
          this.logger.log('   → Setting planId to: basic (from context)');
        } else if (context.includes('premium')) {
          finalPlanId = 'premium';
          this.logger.log('   → Setting planId to: premium (from context)');
        } else {
          // ⚠️ DEFAULT: თუ planId არ გადაეცა და context-ში არ არის 'basic' ან 'premium',
          // მაშინ default-ად ვაყენებთ 'basic'-ს, არა 'premium'-ს!
          finalPlanId = 'basic';
          this.logger.warn(
            '   ⚠️ Context-ში არ არის planId ინფორმაცია, default-ად ვაყენებთ: basic',
          );
        }
      } else {
        this.logger.log(`   ✅ Using provided planId: ${finalPlanId}`);
      }

      if (!finalPlanName) {
        this.logger.warn(
          '⚠️ planName არ გადაეცა! გამოვიყენებთ planId-ის მიხედვით default მნიშვნელობას',
        );
        // Plan Name-ის default მნიშვნელობები
        if (context === 'test' || context === 'test_subscription') {
          finalPlanName = 'ტესტ საბსქრიფშენი';
          this.logger.log(
            '   → Setting planName to: ტესტ საბსქრიფშენი (from context)',
          );
        } else if (finalPlanId === 'basic') {
          finalPlanName = 'ძირითადი პაკეტი';
          this.logger.log(
            '   → Setting planName to: ძირითადი პაკეტი (from planId)',
          );
        } else if (finalPlanId === 'premium') {
          finalPlanName = 'პრემიუმ პაკეტი';
          this.logger.log(
            '   → Setting planName to: პრემიუმ პაკეტი (from planId)',
          );
        } else {
          // ⚠️ DEFAULT: თუ planName არ გადაეცა, default-ად ვაყენებთ 'ძირითადი პაკეტი'-ს
          finalPlanName = 'ძირითადი პაკეტი';
          this.logger.warn(
            '   ⚠️ planId არ არის basic/premium, default-ად ვაყენებთ: ძირითადი პაკეტი',
          );
        }
      } else {
        this.logger.log(`   ✅ Using provided planName: ${finalPlanName}`);
      }

      this.logger.log('📋 Final Plan Configuration:');
      this.logger.log(`   • Final planId: ${finalPlanId}`);
      this.logger.log(`   • Final planName: ${finalPlanName}`);

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
        carfaxRequestsUsed: 0, // პრემიუმ იუზერებისთვის CarFAX მოთხოვნების counter
      };

      const subscription = new this.subscriptionModel(subscriptionData);
      const savedSubscription = await subscription.save();

      this.logger.log(
        `✅ Subscription created successfully: ${String(savedSubscription._id)}`,
      );

      // გავაგზავნოთ push notification user-ისთვის
      try {
        await this.notificationsService.sendPushToUsers(
          [userId],
          {
            title: '🎉 საბსქრიფშენი აქტივირებულია!',
            body: `თქვენი ${finalPlanName} საბსქრიფშენი წარმატებით აქტივირდა. გაიარეთ პრემიუმ ფუნქციები!`,
            data: {
              type: 'subscription_activated',
              subscriptionId: String(savedSubscription._id),
              planId: finalPlanId,
              planName: finalPlanName,
              screen: 'Subscription',
            },
            sound: 'default',
            badge: 1,
          },
          'system',
        );
        this.logger.log(
          `✅ Push notification sent to user: ${userId} for subscription activation`,
        );
      } catch (notificationError) {
        this.logger.error(
          `⚠️ Failed to send push notification for subscription:`,
          notificationError,
        );
        // არ ვაგდებთ error-ს, რადგან subscription უკვე შეიქმნა
      }

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

  /**
   * Subscription-ის bogCardToken-ის განახლება payment-ის მონაცემებიდან
   * @param subscriptionId - Subscription ID
   * @param forceUpdate - თუ true, ყოველთვის ვეძებთ payment-ს, თუნდაც bogCardToken valid UUID იყოს
   */
  /**
   * CarFAX counter-ის განახლება
   */
  async updateCarfaxCounter(
    subscriptionId: string,
    newCount: number,
  ): Promise<SubscriptionDocument | null> {
    try {
      this.logger.log(
        `🔄 Updating CarFAX counter for subscription ${subscriptionId} to ${newCount}`,
      );

      const updated = await this.subscriptionModel.findByIdAndUpdate(
        subscriptionId,
        { carfaxRequestsUsed: newCount, updatedAt: new Date() },
        { new: true },
      );

      if (updated) {
        this.logger.log(
          `✅ CarFAX counter updated successfully: ${updated.carfaxRequestsUsed}`,
        );
      } else {
        this.logger.warn(`⚠️ Subscription not found for ID: ${subscriptionId}`);
      }

      return updated;
    } catch (error) {
      this.logger.error(
        `❌ Failed to update CarFAX counter for subscription ${subscriptionId}:`,
        error,
      );
      throw error;
    }
  }

  async updateSubscriptionTokenFromPayment(
    subscriptionId: string,
    forceUpdate: boolean = false,
  ): Promise<SubscriptionDocument | null> {
    try {
      this.logger.log(
        `🔄 Updating subscription token from payment: ${subscriptionId}${forceUpdate ? ' (force update)' : ''}`,
      );

      const subscription = await this.subscriptionModel
        .findById(subscriptionId)
        .exec();

      if (!subscription) {
        this.logger.error(`❌ Subscription not found: ${subscriptionId}`);
        return null;
      }

      // ვამოწმებთ არის თუ არა bogCardToken valid BOG order_id (UUID format)
      // BOG order_id-ები ჩვეულებრივ არის UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      const isValidBOGOrderId = (token: string | undefined): boolean => {
        if (!token) return false;
        // UUID format: 8-4-4-4-12 hex characters
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(token);
      };

      // თუ bogCardToken უკვე valid BOG order_id-ა და forceUpdate არ არის, არაფერი გავაკეთოთ
      if (
        !forceUpdate &&
        subscription.bogCardToken &&
        isValidBOGOrderId(subscription.bogCardToken)
      ) {
        this.logger.log(
          `✅ Subscription bogCardToken already valid BOG order_id: ${subscription.bogCardToken}`,
        );
        return subscription;
      }

      if (forceUpdate && subscription.bogCardToken) {
        this.logger.log(
          `⚠️ Force update mode: ვეძებთ payment-ს მიუხედავად იმისა რომ bogCardToken valid UUID-ა: ${subscription.bogCardToken}`,
        );
      }

      this.logger.log(
        `⚠️ Subscription bogCardToken არ არის valid BOG order_id: ${subscription.bogCardToken || 'N/A'}`,
      );
      this.logger.log(
        `🔍 ვეძებთ payment-ს user-ისთვის: ${subscription.userId}`,
      );

      // ვპოულობთ payment-ს ამ user-ისთვის რომელსაც აქვს paymentToken ან parentOrderId
      const paymentsCollection = this.connection.collection('payments');
      let payment = (await paymentsCollection.findOne(
        {
          userId: subscription.userId,
          $or: [
            { paymentToken: { $exists: true, $ne: null } },
            { parentOrderId: { $exists: true, $ne: null } },
          ],
          status: { $in: ['completed', 'success'] },
        },
        { sort: { paymentDate: -1 } },
      )) as {
        paymentToken?: string;
        parentOrderId?: string;
        orderId?: string;
        externalOrderId?: string;
        userId?: string;
        _id?: unknown;
      } | null;

      // თუ payment არ მოიძებნა userId-ით, ვეძებთ externalOrderId-ით
      // რადგან subscription-ის bogCardToken შეიძლება იყოს externalOrderId payment-ში
      if (!payment && subscription.bogCardToken) {
        this.logger.log(
          `🔍 Payment არ მოიძებნა userId-ით, ვეძებთ externalOrderId-ით: ${subscription.bogCardToken}`,
        );
        payment = (await paymentsCollection.findOne(
          {
            externalOrderId: subscription.bogCardToken,
            status: { $in: ['completed', 'success'] },
          },
          { sort: { paymentDate: -1 } },
        )) as {
          paymentToken?: string;
          parentOrderId?: string;
          orderId?: string;
          externalOrderId?: string;
          userId?: string;
          _id?: unknown;
        } | null;
      }

      // თუ კვლავ არ მოიძებნა, ვეძებთ orderId-ით, თუ bogCardToken არის valid UUID
      // (ეს შეიძლება იყოს BOG order_id რომელიც შეინახა subscription-ში)
      if (
        !payment &&
        subscription.bogCardToken &&
        isValidBOGOrderId(subscription.bogCardToken)
      ) {
        this.logger.log(
          `🔍 Payment არ მოიძებნა externalOrderId-ით, ვეძებთ orderId-ით: ${subscription.bogCardToken}`,
        );
        payment = (await paymentsCollection.findOne(
          {
            orderId: subscription.bogCardToken,
            status: { $in: ['completed', 'success'] },
          },
          { sort: { paymentDate: -1 } },
        )) as {
          paymentToken?: string;
          parentOrderId?: string;
          orderId?: string;
          externalOrderId?: string;
          userId?: string;
          _id?: unknown;
        } | null;
      }

      // თუ კვლავ არ მოიძებნა, ვეძებთ subscription-ის userId-ით ყველა payment-ს
      // (რადგან შეიძლება payment-ს ჰქონდეს "unknown" userId, მაგრამ externalOrderId შეიცავდეს userId-ს)
      if (!payment && subscription.userId) {
        this.logger.log(
          `🔍 ვეძებთ payment-ს subscription-ის userId-ის შემცველი externalOrderId-ით: ${subscription.userId}`,
        );
        payment = (await paymentsCollection.findOne(
          {
            externalOrderId: { $regex: subscription.userId },
            status: { $in: ['completed', 'success'] },
          },
          { sort: { paymentDate: -1 } },
        )) as {
          paymentToken?: string;
          parentOrderId?: string;
          orderId?: string;
          externalOrderId?: string;
          userId?: string;
          _id?: unknown;
        } | null;
      }

      if (!payment) {
        this.logger.warn(
          `⚠️ No payment found for subscription: ${subscriptionId}`,
        );
        this.logger.warn(`   • Subscription userId: ${subscription.userId}`);
        this.logger.warn(
          `   • Subscription bogCardToken: ${subscription.bogCardToken || 'N/A'}`,
        );
        return subscription;
      }

      this.logger.log(
        `✅ Payment found: ${String(payment._id)} (userId: ${payment.userId || 'N/A'}, orderId: ${payment.orderId || 'N/A'})`,
      );
      this.logger.log(`   • paymentToken: ${payment.paymentToken || 'N/A'}`);
      this.logger.log(`   • parentOrderId: ${payment.parentOrderId || 'N/A'}`);

      // ვპოულობთ valid BOG order_id payment-იდან
      // პრიორიტეტი: parentOrderId > paymentToken (თუ განსხვავდება subscription-ის bogCardToken-ისგან) > orderId (თუ განსხვავდება)
      // თუ paymentToken იგივეა რაც subscription-ის bogCardToken, ეს არ დაგვეხმარება (BOG API-დან მოდის error)
      let bogOrderId = payment.parentOrderId;

      // თუ parentOrderId არ არის, შევამოწმოთ paymentToken, მაგრამ მხოლოდ თუ განსხვავდება subscription-ის bogCardToken-ისგან
      if (
        !bogOrderId &&
        payment.paymentToken &&
        payment.paymentToken !== subscription.bogCardToken
      ) {
        bogOrderId = payment.paymentToken;
        this.logger.log(`📝 Using paymentToken as BOG order_id: ${bogOrderId}`);
      }

      // თუ paymentToken და parentOrderId არ არის, შევამოწმოთ orderId
      // მაგრამ მხოლოდ თუ orderId განსხვავდება subscription-ის bogCardToken-ისგან
      // (რადგან თუ იგივეა, ეს არ დაგვეხმარება - BOG API-დან მოდის error რომ card-ი არ არის saved)
      if (
        !bogOrderId &&
        payment.orderId &&
        isValidBOGOrderId(payment.orderId) &&
        payment.orderId !== subscription.bogCardToken
      ) {
        bogOrderId = payment.orderId;
        this.logger.log(`📝 Using orderId as BOG order_id: ${bogOrderId}`);
      }

      // თუ payment-ს აქვს იგივე orderId რაც subscription-ის bogCardToken-ია,
      // და არ აქვს paymentToken ან parentOrderId, ვეძებთ სხვა payment-ს
      if (
        !bogOrderId &&
        payment.orderId === subscription.bogCardToken &&
        !payment.paymentToken &&
        !payment.parentOrderId
      ) {
        this.logger.log(
          `⚠️ Payment-ს აქვს იგივე orderId რაც subscription-ის bogCardToken-ია, ვეძებთ სხვა payment-ს...`,
        );

        // ვეძებთ სხვა payment-ს ამ user-ისთვის, რომელსაც აქვს paymentToken ან parentOrderId
        // გამოვიყენოთ payment-ის _id-ს პირდაპირ, MongoDB თვითონ გადააქცევს
        const otherPayment = (await paymentsCollection.findOne(
          {
            userId: subscription.userId,
            // @ts-expect-error - MongoDB accepts _id as any type for $ne operator
            _id: { $ne: payment._id }, //განსხვავებული payment-ი
            $or: [
              { paymentToken: { $exists: true, $ne: null } },
              { parentOrderId: { $exists: true, $ne: null } },
            ],
            status: { $in: ['completed', 'success'] },
          },
          { sort: { paymentDate: -1 } },
        )) as {
          paymentToken?: string;
          parentOrderId?: string;
          orderId?: string;
          _id?: unknown;
        } | null;

        if (otherPayment) {
          this.logger.log(
            `✅ Found other payment with paymentToken/parentOrderId: ${String(otherPayment._id)}`,
          );
          bogOrderId = otherPayment.paymentToken || otherPayment.parentOrderId;
        }
      }

      if (!bogOrderId) {
        this.logger.warn(
          `⚠️ Payment found but no valid paymentToken, parentOrderId, or different UUID orderId: ${String(payment._id)}`,
        );
        this.logger.warn(`   • paymentToken: ${payment.paymentToken || 'N/A'}`);
        this.logger.warn(
          `   • parentOrderId: ${payment.parentOrderId || 'N/A'}`,
        );
        this.logger.warn(`   • orderId: ${payment.orderId || 'N/A'}`);
        this.logger.warn(
          `   • subscription bogCardToken: ${subscription.bogCardToken || 'N/A'}`,
        );
        return subscription;
      }

      // ვამოწმებთ რომ bogOrderId არის valid BOG order_id
      if (!isValidBOGOrderId(bogOrderId)) {
        this.logger.warn(
          `⚠️ Found bogOrderId but it's not valid BOG order_id format: ${bogOrderId}`,
        );
        return subscription;
      }

      if (subscription.bogCardToken === bogOrderId) {
        this.logger.log(
          `✅ Subscription bogCardToken already correct: ${bogOrderId}`,
        );
        return subscription;
      }

      subscription.bogCardToken = bogOrderId;
      subscription.updatedAt = new Date();
      const updated = await subscription.save();

      this.logger.log(
        `✅ Subscription bogCardToken updated: ${subscription.bogCardToken} -> ${bogOrderId}`,
      );

      return updated;
    } catch (error) {
      this.logger.error(
        '❌ Failed to update subscription token from payment:',
        error,
      );
      throw error;
    }
  }
}
