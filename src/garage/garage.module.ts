import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GarageController } from './garage.controller';
import { GarageService } from './garage.service';
import { Car, CarSchema } from '../schemas/car.schema';
import { Reminder, ReminderSchema } from '../schemas/reminder.schema';
import { FuelEntry, FuelEntrySchema } from '../schemas/fuel-entry.schema';
import {
  ServiceHistory,
  ServiceHistorySchema,
} from '../schemas/service-history.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Car.name, schema: CarSchema },
      { name: Reminder.name, schema: ReminderSchema },
      { name: FuelEntry.name, schema: FuelEntrySchema },
      { name: ServiceHistory.name, schema: ServiceHistorySchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [GarageController],
  providers: [GarageService],
  exports: [GarageService],
})
export class GarageModule {}
