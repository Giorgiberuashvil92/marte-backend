import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CarwashController } from './carwash.controller';
import { CarwashService } from './carwash.service';
import {
  CarwashLocation,
  CarwashLocationSchema,
} from '../schemas/carwash-location.schema';
import {
  CarwashBooking,
  CarwashBookingSchema,
} from '../schemas/carwash-booking.schema';
import { User, UserSchema } from '../schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CarwashLocation.name, schema: CarwashLocationSchema },
      { name: CarwashBooking.name, schema: CarwashBookingSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [CarwashController],
  providers: [CarwashService],
  exports: [CarwashService],
})
export class CarwashModule {}
