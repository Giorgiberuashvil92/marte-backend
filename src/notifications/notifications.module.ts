import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import {
  Notification,
  NotificationSchema,
} from '../schemas/notification.schema';
import { Store, StoreSchema } from '../schemas/store.schema';
import { Dismantler, DismantlerSchema } from '../schemas/dismantler.schema';
import { DeviceToken, DeviceTokenSchema } from './device-token.schema';
import { User, UserSchema } from '../schemas/user.schema';
import {
  Subscription,
  SubscriptionSchema,
} from '../schemas/subscription.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: Store.name, schema: StoreSchema },
      { name: Dismantler.name, schema: DismantlerSchema },
      { name: DeviceToken.name, schema: DeviceTokenSchema },
      { name: User.name, schema: UserSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
