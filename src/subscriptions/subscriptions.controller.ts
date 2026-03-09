import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Logger,
  HttpException,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * ყველა subscription-ის მიღება
   * GET /subscriptions
   */
  @Get()
  async getAllSubscriptions() {
    try {
      this.logger.log('📊 Getting all subscriptions');

      const subscriptions =
        await this.subscriptionsService.getAllSubscriptions();

      this.logger.log(`✅ Found ${subscriptions.length} subscriptions`);

      return subscriptions;
    } catch (error) {
      this.logger.error('❌ Failed to get subscriptions:', error);
      throw error;
    }
  }

  /**
   * Subscription-ის bogCardToken-ის განახლება payment-ის მონაცემებიდან
   * POST /subscriptions/:id/update-token
   */
  @Post(':id/update-token')
  async updateSubscriptionToken(@Param('id') id: string) {
    try {
      this.logger.log(`🔄 Updating subscription token: ${id}`);

      const subscription =
        await this.subscriptionsService.updateSubscriptionTokenFromPayment(id);

      if (!subscription) {
        return {
          success: false,
          message: 'Subscription not found',
        };
      }

      this.logger.log(`✅ Subscription token updated: ${id}`);

      return {
        success: true,
        message: 'Subscription token updated successfully',
        data: subscription,
      };
    } catch (error) {
      this.logger.error('❌ Failed to update subscription token:', error);
      return {
        success: false,
        message: 'Failed to update subscription token',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * მანქანების ლიმიტის გაზრდა (upgrade)
   * POST /subscriptions/upgrade-fines-cars
   * Body: { userId: string, additionalCars?: number }
   */
  @Post('upgrade-fines-cars')
  async upgradeFinesCarsLimit(
    @Body() body: { userId: string; additionalCars?: number },
  ) {
    try {
      if (!body.userId || body.userId.trim().length === 0) {
        return {
          success: false,
          message: 'userId აუცილებელია',
        };
      }

      this.logger.log(`🚗 Fines cars limit upgrade for user: ${body.userId}`);

      const subscription =
        await this.subscriptionsService.upgradeFinesCarsLimit(
          body.userId.trim(),
          body.additionalCars || 1,
        );

      if (!subscription) {
        return {
          success: false,
          message: 'გამოწერა ვერ მოიძებნა',
        };
      }

      const additionalPrice = (body.additionalCars || 1) * 1;

      return {
        success: true,
        message: `მანქანების ლიმიტი გაიზარდა (+${additionalPrice} ₾/თვე)`,
        data: {
          subscriptionId: String(subscription._id),
          maxFinesCars: subscription.maxFinesCars,
          additionalMonthlyPrice: additionalPrice,
        },
      };
    } catch (error) {
      this.logger.error('❌ Fines cars limit upgrade error:', error);

      if (error instanceof HttpException) {
        return {
          success: false,
          message: error.message,
          statusCode: error.getStatus(),
        };
      }

      return {
        success: false,
        message: 'მანქანების ლიმიტის განახლებისას მოხდა შეცდომა',
        error: error instanceof Error ? error.message : 'უცნობი შეცდომა',
      };
    }
  }

  /**
   * Premium პაკეტის ხელით მინიჭება phone number-ით
   * POST /subscriptions/grant-premium
   * Body: { phone: string, period?: 'monthly' | 'yearly' | 'lifetime' }
   */
  @Post('grant-premium')
  async grantPremiumByPhone(
    @Body() body: { phone: string; period?: 'monthly' | 'yearly' | 'lifetime' },
  ) {
    try {
      if (!body.phone || body.phone.trim().length === 0) {
        return {
          success: false,
          message: 'Phone number აუცილებელია',
        };
      }

      this.logger.log(`🎁 Premium პაკეტის მინიჭება phone: ${body.phone}`);

      const subscription = await this.subscriptionsService.grantPremiumByPhone(
        body.phone.trim(),
        body.period || 'monthly',
      );

      this.logger.log(
        `✅ Premium პაკეტი წარმატებით მიენიჭა phone: ${body.phone}`,
      );

      return {
        success: true,
        message: 'Premium პაკეტი წარმატებით მიენიჭა',
        data: {
          subscriptionId: String(subscription._id),
          userId: subscription.userId,
          planId: subscription.planId,
          planName: subscription.planName,
          period: subscription.period,
          status: subscription.status,
        },
      };
    } catch (error) {
      this.logger.error('❌ Premium პაკეტის მინიჭების შეცდომა:', error);

      if (error instanceof HttpException) {
        return {
          success: false,
          message: error.message,
          statusCode: error.getStatus(),
        };
      }

      return {
        success: false,
        message: 'Premium პაკეტის მინიჭებისას მოხდა შეცდომა',
        error: error instanceof Error ? error.message : 'უცნობი შეცდომა',
      };
    }
  }
}
