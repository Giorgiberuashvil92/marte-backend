import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Offer, OfferSchema } from '../schemas/offer.schema';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { OffersGateway } from './offers.gateway';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Offer.name, schema: OfferSchema }]),
    NotificationsModule,
  ],
  controllers: [OffersController],
  providers: [OffersService, OffersGateway],
  exports: [OffersService],
})
export class OffersModule {}
