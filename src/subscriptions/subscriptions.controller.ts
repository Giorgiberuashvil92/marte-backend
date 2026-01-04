import { Controller, Get, Post, Param, Logger } from '@nestjs/common';
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
}
