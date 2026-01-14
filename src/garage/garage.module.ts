import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { GarageController } from './garage.controller';
import { GarageService } from './garage.service';
import { Car, CarSchema } from '../schemas/car.schema';
import { Reminder, ReminderSchema } from '../schemas/reminder.schema';
import { FuelEntry, FuelEntrySchema } from '../schemas/fuel-entry.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Car.name, schema: CarSchema },
      { name: Reminder.name, schema: ReminderSchema },
      { name: FuelEntry.name, schema: FuelEntrySchema },
    ]),
    ScheduleModule.forRoot(),
    NotificationsModule,
  ],
  controllers: [GarageController],
  providers: [GarageService],
  exports: [GarageService],
})
export class GarageModule {}
