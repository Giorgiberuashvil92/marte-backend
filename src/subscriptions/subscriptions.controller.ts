import { Controller, Get, Logger } from '@nestjs/common';
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

      const subscriptions = await this.subscriptionsService.getAllSubscriptions();

      this.logger.log(`✅ Found ${subscriptions.length} subscriptions`);

      return subscriptions;
    } catch (error) {
      this.logger.error('❌ Failed to get subscriptions:', error);
      throw error;
    }
  }
}

