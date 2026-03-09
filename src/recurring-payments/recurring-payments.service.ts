import { Injectable, Logger, HttpException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import {
  Subscription,
  SubscriptionDocument,
} from '../schemas/subscription.schema';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Dismantler, DismantlerDocument } from '../schemas/dismantler.schema';
import {
  CarFinesSubscription,
  CarFinesSubscriptionDocument,
} from '../schemas/car-fines-subscription.schema';
import { BOGPaymentService } from '../bog/bog-payment.service';
import { PaymentsService } from '../payments/payments.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class RecurringPaymentsService {
  private readonly logger = new Logger(RecurringPaymentsService.name);

  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Payment.name)
    private paymentModel: Model<PaymentDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Dismantler.name)
    private dismantlerModel: Model<DismantlerDocument>,
    @InjectModel(CarFinesSubscription.name)
    private carFinesSubscriptionModel: Model<CarFinesSubscriptionDocument>,
    private bogPaymentService: BOGPaymentService,
    private paymentsService: PaymentsService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  @Cron('0 0,12 * * *', {
    name: 'process-recurring-payments',
    timeZone: 'Asia/Tbilisi',
  })
  async processRecurringPayments() {
    this.logger.log('🔄 რეკურინგ გადახდების დამუშავება დაწყებულია...');

    try {
      const now = new Date();

      // 1. ვნახოთ რომელ subscription-ებს უნდა ჩამოვაჭრათ ახლა (nextBillingDate დადგა)
      this.logger.log(`🔍 ვეძებ subscription-ებს რეკურინგ გადახდისთვის...`);
      this.logger.log(`   • Current time: ${now.toISOString()}`);
      this.logger.log(
        `   • Query: status='active', nextBillingDate <= ${now.toISOString()}, bogCardToken exists`,
      );

      const subscriptionsToCharge = await this.subscriptionModel
        .find({
          status: 'active',
          nextBillingDate: { $lte: now },
          bogCardToken: { $exists: true, $ne: null },
        })
        .exec();

      this.logger.log(
        `📊 ნაპოვნია ${subscriptionsToCharge.length} subscription რეკურინგ გადახდისთვის (nextBillingDate დადგა)`,
      );

      // დეტალური logging თუ subscription-ები ნაპოვნია
      if (subscriptionsToCharge.length > 0) {
        this.logger.log(`📋 ნაპოვნი subscription-ები რეკურინგ გადახდისთვის:`);
        for (const sub of subscriptionsToCharge) {
          this.logger.log(`   • Subscription ID: ${String(sub._id)}`);
          this.logger.log(`   • User ID: ${sub.userId}`);
          this.logger.log(
            `   • Next Billing Date: ${sub.nextBillingDate?.toISOString()}`,
          );
          this.logger.log(`   • BOG Token: ${sub.bogCardToken || 'N/A'}`);
        }
      } else {
        // თუ subscription-ები არ ნაპოვნია, ვნახოთ რატომ
        const allActive = await this.subscriptionModel
          .find({ status: 'active' })
          .exec();
        this.logger.log(
          `⚠️ არ ნაპოვნია subscription-ები რეკურინგ გადახდისთვის`,
        );
        this.logger.log(
          `   • სულ active subscription-ები: ${allActive.length}`,
        );
        if (allActive.length > 0) {
          this.logger.log(`   • Active subscription-ების დეტალები:`);
          for (const sub of allActive) {
            const hasBogToken = sub.bogCardToken ? 'YES' : 'NO';
            const nextBillingPassed = sub.nextBillingDate
              ? sub.nextBillingDate <= now
              : 'N/A';
            this.logger.log(
              `     - ID: ${String(sub._id)}, User: ${sub.userId}, Next Billing: ${sub.nextBillingDate?.toISOString() || 'N/A'}, BOG Token: ${hasBogToken}, Passed: ${nextBillingPassed}`,
            );
          }
        }
      }

      // 2. ვნახოთ რომელ subscription-ებს უნდა ჩამოვაჭრათ მომდევნო საათში
      const nextHour = new Date(now.getTime() + 60 * 60 * 1000); // +1 საათი
      const upcomingSubscriptions = await this.subscriptionModel
        .find({
          status: 'active',
          nextBillingDate: { $gt: now, $lte: nextHour },
          bogCardToken: { $exists: true, $ne: null },
        })
        .exec();

      if (upcomingSubscriptions.length > 0) {
        this.logger.log(
          `⏰ მომდევნო საათში უნდა ჩამოვაჭრათ ${upcomingSubscriptions.length} subscription:`,
        );
        for (const sub of upcomingSubscriptions) {
          const timeUntilBilling = Math.round(
            (sub.nextBillingDate!.getTime() - now.getTime()) / 1000 / 60,
          );
          this.logger.log(
            `   • Subscription ${String(sub._id)}: ${timeUntilBilling} წუთში (${sub.nextBillingDate?.toISOString()})`,
          );
        }
      }

      // 3. ვნახოთ რომელ subscription-ებს უნდა ჩამოვაჭრათ მომდევნო 24 საათში
      const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24 საათი
      const next24HoursSubscriptions = await this.subscriptionModel
        .find({
          status: 'active',
          nextBillingDate: { $gt: nextHour, $lte: next24Hours },
          bogCardToken: { $exists: true, $ne: null },
        })
        .exec();

      if (next24HoursSubscriptions.length > 0) {
        this.logger.log(
          `📅 მომდევნო 24 საათში უნდა ჩამოვაჭრათ ${next24HoursSubscriptions.length} subscription`,
        );
      }

      // 4. დაშლილებისთვის recurring payment-ების დამუშავება
      this.logger.log(`🔍 ვეძებ დაშლილებს რეკურინგ გადახდისთვის...`);
      const dismantlersToCharge = await this.dismantlerModel
        .find({
          status: { $in: ['active', 'approved'] },
          expiryDate: { $lte: now },
          bogCardToken: { $exists: true, $ne: null },
        })
        .exec();

      this.logger.log(
        `📊 ნაპოვნია ${dismantlersToCharge.length} დაშლილი რეკურინგ გადახდისთვის (expiryDate დადგა)`,
      );

      if (dismantlersToCharge.length > 0) {
        this.logger.log(`📋 ნაპოვნი დაშლილები რეკურინგ გადახდისთვის:`);
        for (const dismantler of dismantlersToCharge) {
          this.logger.log(`   • Dismantler ID: ${String(dismantler._id)}`);
          this.logger.log(`   • Owner ID: ${dismantler.ownerId}`);
          this.logger.log(
            `   • Expiry Date: ${dismantler.expiryDate?.toISOString()}`,
          );
          this.logger.log(
            `   • BOG Token: ${dismantler.bogCardToken || 'N/A'}`,
          );
          this.logger.log(
            `   • VIP: ${dismantler.isVip ? 'Yes (20₾)' : 'No (5₾)'}`,
          );
        }
      }

      // 5. CarFinesSubscription-ების მოძებნა რეკურინგ გადახდისთვის
      this.logger.log(
        `🔍 ვეძებ CarFinesSubscription-ებს რეკურინგ გადახდისთვის...`,
      );
      const carFinesSubsToCharge = await this.carFinesSubscriptionModel
        .find({
          status: 'active',
          isPaid: true,
          isFirstCar: false, // პირველი უფასოა, მხოლოდ დამატებითებს ვაჭრით
          nextBillingDate: { $lte: now },
          bogCardToken: { $exists: true, $ne: null },
        })
        .exec();

      this.logger.log(
        `📊 ნაპოვნია ${carFinesSubsToCharge.length} CarFinesSubscription რეკურინგ გადახდისთვის`,
      );

      if (carFinesSubsToCharge.length > 0) {
        this.logger.log(
          `📋 ნაპოვნი CarFinesSubscription-ები რეკურინგ გადახდისთვის:`,
        );
        for (const carSub of carFinesSubsToCharge) {
          this.logger.log(
            `   • CarFinesSub ID: ${String(carSub._id)}, User: ${carSub.userId}, Vehicle: ${carSub.vehicleNumber}, Price: ${carSub.price}₾`,
          );
        }
      }

      // 6. გადახდების დამუშავება
      let successCount = 0;
      let failureCount = 0;
      let dismantlerSuccessCount = 0;
      let dismantlerFailureCount = 0;
      let carFinesSuccessCount = 0;
      let carFinesFailureCount = 0;

      // Subscription-ების გადახდა
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

      // დაშლილების გადახდა
      for (const dismantler of dismantlersToCharge) {
        try {
          await this.processDismantlerPayment(dismantler);
          dismantlerSuccessCount++;
        } catch (error: unknown) {
          const dismantlerId = String(dismantler._id);
          this.logger.error(
            `❌ Dismantler ${dismantlerId} გადახდის შეცდომა:`,
            error instanceof Error ? error.message : 'Unknown error',
          );
          dismantlerFailureCount++;
        }
      }

      // CarFinesSubscription-ების გადახდა
      for (const carFinesSub of carFinesSubsToCharge) {
        try {
          await this.processCarFinesSubscriptionPayment(carFinesSub);
          carFinesSuccessCount++;
        } catch (error: unknown) {
          const carFinesSubId = String(carFinesSub._id);
          this.logger.error(
            `❌ CarFinesSubscription ${carFinesSubId} გადახდის შეცდომა:`,
            error instanceof Error ? error.message : 'Unknown error',
          );
          carFinesFailureCount++;

          // თუ გადახდა ვერ მოხერხდა, isPaid = false ვაყენებთ
          await this.carFinesSubscriptionModel.findByIdAndUpdate(
            carFinesSubId,
            {
              isPaid: false,
              status: 'expired',
            },
          );
        }
      }

      this.logger.log(`✅ რეკურინგ გადახდების დამუშავება დასრულდა:`);
      this.logger.log(
        `   • Subscriptions: ${successCount} წარმატებული, ${failureCount} წარუმატებელი`,
      );
      this.logger.log(
        `   • Dismantlers: ${dismantlerSuccessCount} წარმატებული, ${dismantlerFailureCount} წარუმატებელი`,
      );
      this.logger.log(
        `   • CarFinesSubs: ${carFinesSuccessCount} წარმატებული, ${carFinesFailureCount} წარუმატებელი`,
      );
      this.logger.log(
        `📊 სტატისტიკა: ${subscriptionsToCharge.length} subscription, ${dismantlersToCharge.length} დაშლილი, ${carFinesSubsToCharge.length} მანქანის გამოწერა, ${upcomingSubscriptions.length} subscription მომდევნო საათში, ${next24HoursSubscriptions.length} subscription მომდევნო 24 საათში`,
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

    // შევქმნათ ახალი order ID userId-ს ჩართვით
    const shopOrderId = `recurring_${subscriptionId}_${Date.now()}_${subscription.userId}`;

    // BOG recurring payment-ის განხორციელება
    // BOG API დოკუმენტაციის მიხედვით, parent_order_id არის წარმატებული გადახდის order_id
    // სხვა პარამეტრები (თანხა, ვალუტა) ავტომატურად იღება parent_order_id-დან
    let recurringPaymentResult;
    try {
      recurringPaymentResult =
        await this.bogPaymentService.processRecurringPayment({
          parent_order_id: subscription.bogCardToken, // ეს არის წარმატებული გადახდის order_id
          external_order_id: shopOrderId, // shop order ID (userId-ს ჩართვით)
          // Legacy fields for backward compatibility (not used in API request)
          order_id: subscription.bogCardToken,
          amount: subscription.planPrice,
          currency: subscription.currency || 'GEL',
          shop_order_id: shopOrderId,
          purchase_description: `${subscription.planName} - ${subscription.period} subscription`,
        });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // თუ error-ი არის "Error during getting saved card info", ეს ნიშნავს რომ
      // bogCardToken არ არის valid saved card ID BOG-ში
      // ვცდილობთ განვაახლოთ subscription-ის bogCardToken სწორი BOG order_id-ით
      if (
        errorMessage.includes('Error during getting saved card info') ||
        errorMessage.includes('cardId') ||
        (error instanceof HttpException && error.getStatus() === 404)
      ) {
        this.logger.warn(
          `⚠️ BOG card არ მოიძებნა subscription-ისთვის ${subscriptionId}, ვცდილობთ bogCardToken-ის განახლებას...`,
        );

        try {
          // forceUpdate: true - ვეძებთ payment-ს მიუხედავად იმისა რომ bogCardToken valid UUID-ა
          // რადგან BOG API-დან მოდის error რომ card-ი არ არის saved
          const updatedSubscription =
            await this.subscriptionsService.updateSubscriptionTokenFromPayment(
              subscriptionId,
              true, // forceUpdate
            );

          if (
            updatedSubscription &&
            updatedSubscription.bogCardToken &&
            updatedSubscription.bogCardToken !== subscription.bogCardToken
          ) {
            this.logger.log(
              `✅ Subscription bogCardToken განახლდა: ${subscription.bogCardToken} -> ${updatedSubscription.bogCardToken}`,
            );

            // ვცდილობთ კვლავ recurring payment-ის განხორციელებას ახალი bogCardToken-ით
            this.logger.log(
              `🔄 ვცდილობთ recurring payment-ის განხორციელებას ახალი bogCardToken-ით...`,
            );
            recurringPaymentResult =
              await this.bogPaymentService.processRecurringPayment({
                parent_order_id: updatedSubscription.bogCardToken,
                external_order_id: shopOrderId,
                order_id: updatedSubscription.bogCardToken,
                amount: subscription.planPrice,
                currency: subscription.currency || 'GEL',
                shop_order_id: shopOrderId,
                purchase_description: `${subscription.planName} - ${subscription.period} subscription`,
              });
          } else {
            // თუ bogCardToken-ის განახლება ვერ მოხერხდა, ვაგდებთ original error-ს
            throw error;
          }
        } catch (updateError) {
          this.logger.error(
            `❌ Failed to update subscription token or retry payment:`,
            updateError,
          );
          // ვაგდებთ original error-ს
          throw error;
        }
      } else {
        // სხვა error-ებისთვის, ვაგდებთ error-ს როგორც არის
        throw error;
      }
    }

    // BOG API დოკუმენტაციის მიხედვით, response არის: { id: string, _links: { details: { href: string } } }
    // თუ response მიღებულია, ეს ნიშნავს რომ მოთხოვნა წარმატებით გაიგზავნა
    const paymentResult = recurringPaymentResult as {
      id?: string;
      order_id?: string;
      message?: string;
    };
    const newOrderId = paymentResult.id || paymentResult.order_id;

    if (!newOrderId) {
      throw new Error(
        `BOG recurring payment ვერ მოხერხდა: ${paymentResult.message || 'Unknown error'}`,
      );
    }

    // გადახდის შენახვა database-ში (payments collection-ში)
    // Payment-ი შევქმნათ 'pending' status-ით, რომ BOG callback-ში განახლდეს
    // Subscription-ის განახლება გადავიტანოთ BOG callback-ში, მხოლოდ მაშინ, როცა payment-ი წარმატებულია
    this.logger.log(
      '💾 Recurring payment-ის შენახვა payments collection-ში (pending status-ით)...',
    );
    const payment = await this.paymentsService.createPayment({
      userId: subscription.userId,
      orderId: newOrderId,
      amount: subscription.planPrice,
      currency: subscription.currency || 'GEL',
      paymentMethod: 'BOG',
      status: 'pending', // შევქმნათ pending status-ით, რომ BOG callback-ში განახლდეს
      context: 'subscription',
      description: `${subscription.planName} - ${subscription.period} subscription (Billing Cycle ${subscription.billingCycles + 1})`,
      paymentDate: new Date().toISOString(),
      isRecurring: true,
      recurringPaymentId: subscriptionId,
      externalOrderId: shopOrderId, // external_order_id userId-ს ჩართვით
      metadata: {
        serviceName: `${subscription.planName} - ${subscription.period} subscription`,
        planId: subscription.planId,
        planName: subscription.planName,
        planPrice:
          typeof subscription.planPrice === 'number'
            ? subscription.planPrice.toString()
            : String(subscription.planPrice || ''),
        planCurrency: subscription.currency || 'GEL',
        planPeriod: subscription.period,
      },
    });
    this.logger.log(
      `✅ Recurring payment შეინახა payments collection-ში (pending status-ით): ${String(payment._id)}`,
    );
    this.logger.log(
      `   • Payment status განახლდება BOG callback-ში (completed/rejected)`,
    );
    this.logger.log(
      `   • Subscription-ის nextBillingDate განახლდება BOG callback-ში, მხოლოდ მაშინ, როცა payment-ი წარმატებულია`,
    );
  }

  /**
   * ერთი CarFinesSubscription-ის გადახდის დამუშავება (1₾/თვე)
   */
  private async processCarFinesSubscriptionPayment(
    carFinesSub: CarFinesSubscriptionDocument,
  ): Promise<void> {
    const carFinesSubId = String(carFinesSub._id);
    this.logger.log(
      `💳 CarFinesSubscription ${carFinesSubId} გადახდის დამუშავება (${carFinesSub.vehicleNumber})...`,
    );

    if (!carFinesSub.bogCardToken) {
      throw new Error(
        'BOG payment token არ არის მოწოდებული CarFinesSubscription-ისთვის',
      );
    }

    const shopOrderId = `car_fines_recurring_${carFinesSubId}_${Date.now()}_${carFinesSub.userId}`;

    const recurringPaymentResult =
      await this.bogPaymentService.processRecurringPayment({
        parent_order_id: carFinesSub.bogCardToken,
        external_order_id: shopOrderId,
        order_id: carFinesSub.bogCardToken,
        amount: carFinesSub.price,
        currency: 'GEL',
        shop_order_id: shopOrderId,
        purchase_description: `ჯარიმების მონიტორინგი - ${carFinesSub.vehicleNumber} (${carFinesSub.price}₾/თვე)`,
      });

    const paymentResult = recurringPaymentResult as {
      id?: string;
      order_id?: string;
      message?: string;
    };
    const newOrderId = paymentResult.id || paymentResult.order_id;

    if (!newOrderId) {
      throw new Error(
        `BOG recurring payment ვერ მოხერხდა CarFinesSubscription-ისთვის: ${paymentResult.message || 'Unknown error'}`,
      );
    }

    // Payment-ის შენახვა
    await this.paymentsService.createPayment({
      userId: carFinesSub.userId,
      orderId: newOrderId,
      amount: carFinesSub.price,
      currency: 'GEL',
      paymentMethod: 'BOG',
      status: 'pending',
      context: 'car_fines_subscription',
      description: `ჯარიმების მონიტორინგი - ${carFinesSub.vehicleNumber} (Billing Cycle ${carFinesSub.billingCycles + 1})`,
      paymentDate: new Date().toISOString(),
      isRecurring: true,
      recurringPaymentId: carFinesSubId,
      externalOrderId: shopOrderId,
      metadata: {
        carFinesSubscriptionId: carFinesSubId,
        carId: carFinesSub.carId,
        vehicleNumber: carFinesSub.vehicleNumber,
        serviceName: `ჯარიმების მონიტორინგი - ${carFinesSub.vehicleNumber}`,
      },
    });

    this.logger.log(
      `✅ CarFinesSubscription recurring payment გაგზავნილია: ${newOrderId}`,
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
   * Upcoming payments-ის მიღება (როდის უნდა ჩამოვაჭრათ)
   * @param hours - რამდენი საათის განმავლობაში უნდა ვნახოთ upcoming payments (default: 24)
   */
  async getUpcomingPayments(hours: number = 24): Promise<{
    now: Date;
    upcoming: Array<{
      subscriptionId: string;
      userId: string;
      planName: string;
      amount: number;
      currency: string;
      nextBillingDate: Date;
      timeUntilBilling: string; // "2 საათი 30 წუთი"
    }>;
    summary: {
      total: number;
      nextHour: number;
      next24Hours: number;
    };
  }> {
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    const targetTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const upcomingSubscriptions = await this.subscriptionModel
      .find({
        status: 'active',
        nextBillingDate: { $gt: now, $lte: targetTime },
        bogCardToken: { $exists: true, $ne: null },
      })
      .sort({ nextBillingDate: 1 })
      .exec();

    const upcoming = upcomingSubscriptions.map((sub) => {
      const timeUntilBilling = sub.nextBillingDate!.getTime() - now.getTime();
      const hoursUntil = Math.floor(timeUntilBilling / (1000 * 60 * 60));
      const minutesUntil = Math.floor(
        (timeUntilBilling % (1000 * 60 * 60)) / (1000 * 60),
      );

      let timeUntilBillingStr = '';
      if (hoursUntil > 0) {
        timeUntilBillingStr += `${hoursUntil} საათი`;
      }
      if (minutesUntil > 0) {
        if (timeUntilBillingStr) timeUntilBillingStr += ' ';
        timeUntilBillingStr += `${minutesUntil} წუთი`;
      }
      if (!timeUntilBillingStr) {
        timeUntilBillingStr = 'ნაკლები 1 წუთი';
      }

      return {
        subscriptionId: String(sub._id),
        userId: sub.userId,
        planName: sub.planName,
        amount: sub.planPrice,
        currency: sub.currency || 'GEL',
        nextBillingDate: sub.nextBillingDate!,
        timeUntilBilling: timeUntilBillingStr,
      };
    });

    const nextHourCount = upcomingSubscriptions.filter(
      (sub) => sub.nextBillingDate! <= nextHour,
    ).length;

    return {
      now,
      upcoming,
      summary: {
        total: upcoming.length,
        nextHour: nextHourCount,
        next24Hours: upcoming.length,
      },
    };
  }

  /**
   * ერთი დაშლილის გადახდის დამუშავება
   */
  private async processDismantlerPayment(
    dismantler: DismantlerDocument,
  ): Promise<void> {
    const dismantlerId = String(dismantler._id);
    this.logger.log(`💳 Dismantler ${dismantlerId} გადახდის დამუშავება...`);

    if (!dismantler.bogCardToken) {
      throw new Error('BOG payment token არ არის მოწოდებული');
    }

    // თანხის განსაზღვრა VIP-ის მიხედვით
    const paymentAmount = dismantler.isVip ? 20 : 5;
    const paymentCurrency = 'GEL';

    // შევქმნათ ახალი order ID
    const shopOrderId = `recurring_dismantler_${dismantlerId}_${Date.now()}_${dismantler.ownerId}`;

    // BOG recurring payment-ის განხორციელება
    let recurringPaymentResult;
    try {
      recurringPaymentResult =
        await this.bogPaymentService.processRecurringPayment({
          parent_order_id: dismantler.bogCardToken,
          external_order_id: shopOrderId,
          order_id: dismantler.bogCardToken,
          amount: paymentAmount,
          currency: paymentCurrency,
          shop_order_id: shopOrderId,
          purchase_description: `დაშლილების განცხადება - ${dismantler.brand} ${dismantler.model}${dismantler.isVip ? ' (VIP)' : ''}`,
        });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `❌ BOG recurring payment ვერ მოხერხდა დაშლილისთვის ${dismantlerId}: ${errorMessage}`,
      );
      throw error;
    }

    // BOG API response-ის დამუშავება
    const paymentResult = recurringPaymentResult as {
      id?: string;
      order_id?: string;
      message?: string;
    };

    const newOrderId = paymentResult.id || paymentResult.order_id;

    if (!newOrderId) {
      throw new Error(
        `BOG recurring payment ვერ მოხერხდა: ${paymentResult.message || 'Unknown error'}`,
      );
    }

    this.logger.log(
      `✅ BOG recurring payment წარმატებით განხორციელდა დაშლილისთვის: ${newOrderId}`,
    );

    // გადახდის შენახვა database-ში (pending status-ით, BOG callback განაახლებს)
    const payment = await this.paymentsService.createPayment({
      userId: dismantler.ownerId,
      orderId: newOrderId,
      amount: paymentAmount,
      currency: paymentCurrency,
      paymentMethod: 'BOG',
      status: 'pending', // BOG callback განაახლებს
      context: 'dismantler',
      description: `დაშლილების განცხადება - ${dismantler.brand} ${dismantler.model}${dismantler.isVip ? ' (VIP)' : ''}`,
      paymentDate: new Date().toISOString(),
      isRecurring: true,
      recurringPaymentId: dismantlerId,
      externalOrderId: shopOrderId,
      metadata: {
        serviceName: `დაშლილების განცხადება - ${dismantler.brand} ${dismantler.model}`,
        serviceId: dismantlerId,
      },
    });

    this.logger.log(
      `✅ Recurring payment შეინახა payments collection-ში (pending status-ით): ${String(payment._id)}`,
    );
    this.logger.log(`   • Dismantler ID: ${dismantlerId}`);
    this.logger.log(`   • Amount: ${paymentAmount} ${paymentCurrency}`);
    this.logger.log(`   • New Order ID: ${newOrderId}`);

    // დაშლილის expiryDate-ის განახლება (1 თვე ახლიდან)
    // მაგრამ მხოლოდ BOG callback-ში, როცა payment-ი completed იქნება
    // აქ ვტოვებთ pending-ად, რომ BOG callback განაახლოს
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

    this.logger.log(
      `📊 Found ${subscriptionsToCharge.length} subscriptions to charge`,
    );
    if (subscriptionsToCharge.length > 0) {
      subscriptionsToCharge.forEach((sub) => {
        this.logger.log(`   • Subscription ID: ${String(sub._id)}`);
        this.logger.log(`   • User ID: ${sub.userId}`);
        this.logger.log(
          `   • Next Billing Date: ${sub.nextBillingDate?.toISOString()}`,
        );
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

  /**
   * პირდაპირ order_id-ით recurring payment-ის გაშვება (subscription-ის გარეშე)
   * @param parentOrderId - BOG order_id რომელზეც მოხდა ბარათის დამახსოვრება
   * @param amount - გადასახდელი თანხა (optional, თუ არ გადმოცემულია, გამოიყენება payment-ის თანხა)
   * @param externalOrderId - external order ID (optional)
   */
  async processRecurringPaymentByOrderId(
    parentOrderId: string,
    amount?: number,
    externalOrderId?: string,
  ): Promise<{
    success: boolean;
    message: string;
    newOrderId: string;
    paymentId?: string;
  }> {
    this.logger.log(
      `🔄 Recurring payment გაშვება parent_order_id: ${parentOrderId}-ით...`,
    );

    // ვპოულობთ payment-ს ამ order_id-ით
    const originalPayment = await this.paymentModel
      .findOne({ orderId: parentOrderId })
      .exec();

    if (!originalPayment) {
      this.logger.warn(`⚠️ Payment ვერ მოიძებნა order_id: ${parentOrderId}-ით`);
      throw new Error(`Payment ვერ მოიძებნა order_id: ${parentOrderId}-ით`);
    }

    this.logger.log(`✅ Payment ნაპოვნია: ${String(originalPayment._id)}`);
    this.logger.log(`   • User ID: ${originalPayment.userId}`);
    this.logger.log(
      `   • Amount: ${originalPayment.amount} ${originalPayment.currency}`,
    );
    this.logger.log(`   • Order ID: ${originalPayment.orderId}`);

    // გამოვიყენოთ payment-ის თანხა თუ amount არ გადმოცემულია
    const paymentAmount = amount || originalPayment.amount;
    const paymentCurrency = originalPayment.currency || 'GEL';

    // შევქმნათ external order ID თუ არ გადმოცემულია
    const shopOrderId =
      externalOrderId || `recurring_${parentOrderId}_${Date.now()}`;

    try {
      // BOG recurring payment-ის განხორციელება
      const recurringPaymentResult =
        await this.bogPaymentService.processRecurringPayment({
          parent_order_id: parentOrderId,
          external_order_id: shopOrderId,
          // Legacy fields for backward compatibility
          order_id: parentOrderId,
          amount: paymentAmount,
          currency: paymentCurrency,
          shop_order_id: shopOrderId,
          purchase_description: `Recurring payment for order ${parentOrderId}`,
        });

      // BOG API დოკუმენტაციის მიხედვით, response არის: { id: string, _links: { details: { href: string } } }
      const newOrderId =
        recurringPaymentResult.id || recurringPaymentResult.order_id;

      if (!newOrderId) {
        throw new Error(
          `BOG recurring payment ვერ მოხერხდა: ${recurringPaymentResult.message || 'Unknown error'}`,
        );
      }

      this.logger.log(
        `✅ BOG recurring payment წარმატებით განხორციელდა: ${newOrderId}`,
      );

      // გადახდის შენახვა database-ში
      const payment = await this.paymentsService.createPayment({
        userId: originalPayment.userId,
        orderId: newOrderId,
        amount: paymentAmount,
        currency: paymentCurrency,
        paymentMethod: 'BOG',
        status: 'completed',
        context: 'recurring',
        description: `Recurring payment for order ${parentOrderId}`,
        paymentDate: new Date().toISOString(),
        isRecurring: true,
        parentOrderId: parentOrderId,
        externalOrderId: shopOrderId,
        metadata: {
          serviceName: 'Recurring payment',
          serviceId: parentOrderId, // Original order ID
        },
      });

      this.logger.log(
        `✅ Recurring payment წარმატებით დასრულდა parent_order_id: ${parentOrderId}-ით`,
      );
      this.logger.log(`   • New Order ID: ${newOrderId}`);
      this.logger.log(`   • Payment ID: ${String(payment._id)}`);

      return {
        success: true,
        message: 'Recurring payment წარმატებით დასრულდა',
        newOrderId: newOrderId,
        paymentId: String(payment._id),
      };
    } catch (error: unknown) {
      this.logger.error(
        `❌ Recurring payment შეცდომა parent_order_id: ${parentOrderId}-ით:`,
        error instanceof Error ? error.message : 'Unknown error',
      );

      throw error;
    }
  }

  /**
   * Payment ID-ით recurring payment-ის გაშვება
   * @param paymentId - Payment ID (MongoDB _id)
   * @param amount - გადასახდელი თანხა (optional, თუ არ გადმოცემულია, გამოიყენება payment-ის თანხა)
   * @param externalOrderId - external order ID (optional)
   */
  async processRecurringPaymentByPaymentId(
    paymentId: string,
    amount?: number,
    externalOrderId?: string,
  ): Promise<{
    success: boolean;
    message: string;
    newOrderId: string;
    paymentId?: string;
    bogOrderId?: string;
  }> {
    this.logger.log(
      `🔄 Recurring payment გაშვება payment ID: ${paymentId}-ით...`,
    );

    // ვპოულობთ payment-ს ID-ით
    const originalPayment = await this.paymentModel.findById(paymentId).exec();

    if (!originalPayment) {
      this.logger.warn(`⚠️ Payment ვერ მოიძებნა ID: ${paymentId}-ით`);
      throw new Error(`Payment ვერ მოიძებნა ID: ${paymentId}-ით`);
    }

    this.logger.log(`✅ Payment ნაპოვნია: ${String(originalPayment._id)}`);
    this.logger.log(`   • User ID: ${originalPayment.userId}`);
    this.logger.log(
      `   • Amount: ${originalPayment.amount} ${originalPayment.currency}`,
    );
    this.logger.log(`   • Order ID: ${originalPayment.orderId}`);
    this.logger.log(
      `   • Payment Token: ${originalPayment.paymentToken || 'N/A'}`,
    );
    this.logger.log(
      `   • Parent Order ID: ${originalPayment.parentOrderId || 'N/A'}`,
    );

    // BOG order_id-ის მიღება paymentToken-იდან ან parentOrderId-დან
    const bogOrderId =
      originalPayment.paymentToken ||
      originalPayment.parentOrderId ||
      originalPayment.orderId;

    if (!bogOrderId) {
      throw new Error(
        `Payment-ს არ აქვს paymentToken ან parentOrderId. BOG order_id ვერ მოიძებნა.`,
      );
    }

    this.logger.log(`   • BOG Order ID (გამოყენებული): ${bogOrderId}`);

    // გამოვიყენოთ payment-ის თანხა თუ amount არ გადმოცემულია
    const paymentAmount = amount || originalPayment.amount;
    const paymentCurrency = originalPayment.currency || 'GEL';

    // შევქმნათ external order ID თუ არ გადმოცემულია
    const shopOrderId =
      externalOrderId ||
      `recurring_${originalPayment.orderId}_${Date.now()}_${originalPayment.userId}`;

    try {
      // BOG recurring payment-ის განხორციელება
      const recurringPaymentResult =
        await this.bogPaymentService.processRecurringPayment({
          parent_order_id: bogOrderId,
          external_order_id: shopOrderId,
          // Legacy fields for backward compatibility
          order_id: bogOrderId,
          amount: paymentAmount,
          currency: paymentCurrency,
          shop_order_id: shopOrderId,
          purchase_description: `Recurring payment for ${originalPayment.context || 'service'}`,
        });

      // BOG API დოკუმენტაციის მიხედვით, response არის: { id: string, _links: { details: { href: string } } }
      const newOrderId =
        recurringPaymentResult.id || recurringPaymentResult.order_id;

      if (!newOrderId) {
        throw new Error(
          `BOG recurring payment ვერ მოხერხდა: ${recurringPaymentResult.message || 'Unknown error'}`,
        );
      }

      this.logger.log(
        `✅ BOG recurring payment წარმატებით განხორციელდა: ${newOrderId}`,
      );

      // გადახდის შენახვა database-ში (pending status-ით, BOG callback განაახლებს)
      const payment = await this.paymentsService.createPayment({
        userId: originalPayment.userId,
        orderId: newOrderId,
        amount: paymentAmount,
        currency: paymentCurrency,
        paymentMethod: 'BOG',
        status: 'pending', // BOG callback განაახლებს
        context: originalPayment.context || 'recurring',
        description: `Recurring payment for ${originalPayment.description || originalPayment.context || 'service'}`,
        paymentDate: new Date().toISOString(),
        isRecurring: true,
        parentOrderId: bogOrderId,
        externalOrderId: shopOrderId,
        metadata: {
          ...(originalPayment.metadata || {}),
          serviceName:
            originalPayment.metadata?.serviceName || 'Recurring payment',
          serviceId: originalPayment.orderId, // Original order ID
        },
      });

      this.logger.log(
        `✅ Recurring payment წარმატებით დასრულდა payment ID: ${paymentId}-ით`,
      );
      this.logger.log(`   • New Order ID: ${newOrderId}`);
      this.logger.log(`   • Payment ID: ${String(payment._id)}`);
      this.logger.log(`   • BOG Order ID: ${bogOrderId}`);

      return {
        success: true,
        message: 'Recurring payment წარმატებით დასრულდა',
        newOrderId: newOrderId,
        paymentId: String(payment._id),
        bogOrderId: bogOrderId,
      };
    } catch (error: unknown) {
      this.logger.error(
        `❌ Recurring payment შეცდომა payment ID: ${paymentId}-ით:`,
        error instanceof Error ? error.message : 'Unknown error',
      );

      throw error;
    }
  }

  /**
   * კონკრეტული order_id-ით recurring payment-ის ტესტირება
   * @param orderId - BOG order_id რომელიც გამოიყენება როგორც bogCardToken
   */
  async testRecurringPaymentByOrderId(orderId: string): Promise<{
    success: boolean;
    message: string;
    orderId: string;
    subscriptionId?: string;
    paymentResult?: any;
  }> {
    this.logger.log(`🧪 Recurring payment ტესტი order_id: ${orderId}-ით...`);

    // ვპოულობთ subscription-ს ამ order_id-ით (bogCardToken)
    const subscription = await this.subscriptionModel
      .findOne({ bogCardToken: orderId, status: 'active' })
      .exec();

    if (!subscription) {
      this.logger.warn(`⚠️ Subscription ვერ მოიძებნა order_id: ${orderId}-ით`);
      throw new Error(
        `Subscription ვერ მოიძებნა order_id: ${orderId}-ით. დარწმუნდით რომ subscription არსებობს და აქვს bogCardToken: ${orderId}`,
      );
    }

    this.logger.log(`✅ Subscription ნაპოვნია: ${String(subscription._id)}`);
    this.logger.log(`   • User ID: ${subscription.userId}`);
    this.logger.log(`   • Plan: ${subscription.planName}`);
    this.logger.log(
      `   • Amount: ${subscription.planPrice} ${subscription.currency}`,
    );
    this.logger.log(`   • BOG Token: ${subscription.bogCardToken}`);

    try {
      // გადახდის დამუშავება
      await this.processSubscriptionPayment(subscription);

      this.logger.log(
        `✅ Recurring payment წარმატებით დასრულდა order_id: ${orderId}-ით`,
      );

      return {
        success: true,
        message: 'Recurring payment წარმატებით დასრულდა',
        orderId: orderId,
        subscriptionId: String(subscription._id),
      };
    } catch (error: unknown) {
      this.logger.error(
        `❌ Recurring payment შეცდომა order_id: ${orderId}-ით:`,
        error instanceof Error ? error.message : 'Unknown error',
      );

      throw error;
    }
  }
}
