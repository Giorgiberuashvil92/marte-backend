import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SpecialOffersController } from './special-offers.controller';
import { SpecialOffersService } from './special-offers.service';
import {
  SpecialOffer,
  SpecialOfferSchema,
} from '../schemas/special-offer.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SpecialOffer.name, schema: SpecialOfferSchema },
    ]),
  ],
  controllers: [SpecialOffersController],
  providers: [SpecialOffersService],
  exports: [SpecialOffersService],
})
export class SpecialOffersModule {}
