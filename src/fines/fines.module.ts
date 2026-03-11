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
import { User, UserSchema } from '../schemas/user.schema';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: FinesVehicle.name, schema: FinesVehicleSchema },
      { name: CarFinesSubscription.name, schema: CarFinesSubscriptionSchema },
      { name: User.name, schema: UserSchema },
    ]),
    SubscriptionsModule,
  ],
  controllers: [FinesController],
  providers: [FinesService],
  exports: [FinesService],
})
export class FinesModule {}
