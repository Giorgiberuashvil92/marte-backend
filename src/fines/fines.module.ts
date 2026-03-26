import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { FinesController } from './fines.controller';
import { FinesService } from './fines.service';
import {
  FinesVehicle,
  FinesVehicleSchema,
} from '../schemas/fines-vehicle.schema';
import {
  CarFinesSubscription,
  CarFinesSubscriptionSchema,
} from '../schemas/car-fines-subscription.schema';
import {
  FinesRegistrationLog,
  FinesRegistrationLogSchema,
} from '../schemas/fines-registration-log.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  FinesDailyReminder,
  FinesDailyReminderSchema,
} from '../schemas/fines-daily-reminder.schema';
import {
  FinesPenaltyCache,
  FinesPenaltyCacheSchema,
} from '../schemas/fines-penalty-cache.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: FinesVehicle.name, schema: FinesVehicleSchema },
      { name: CarFinesSubscription.name, schema: CarFinesSubscriptionSchema },
      { name: FinesRegistrationLog.name, schema: FinesRegistrationLogSchema },
      { name: User.name, schema: UserSchema },
      { name: FinesDailyReminder.name, schema: FinesDailyReminderSchema },
      { name: FinesPenaltyCache.name, schema: FinesPenaltyCacheSchema },
    ]),
    SubscriptionsModule,
    NotificationsModule,
  ],
  controllers: [FinesController],
  providers: [FinesService],
  exports: [FinesService],
})
export class FinesModule {}
