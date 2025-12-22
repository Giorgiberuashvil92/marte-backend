import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CarRentalController } from './car-rental.controller';
import { CarRentalService } from './car-rental.service';
import { CarRental, CarRentalSchema } from '../schemas/car-rental.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CarRental.name, schema: CarRentalSchema },
    ]),
  ],
  controllers: [CarRentalController],
  providers: [CarRentalService],
  exports: [CarRentalService],
})
export class CarRentalModule {}
