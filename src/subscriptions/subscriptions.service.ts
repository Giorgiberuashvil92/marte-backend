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
}

