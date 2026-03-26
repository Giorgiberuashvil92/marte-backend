import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExclusiveOfferController } from './exclusive-offer.controller';
import { ExclusiveOfferService } from './exclusive-offer.service';
import {
  ExclusiveOfferRequest,
  ExclusiveOfferRequestSchema,
} from '../schemas/exclusive-offer-request.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExclusiveOfferRequest.name, schema: ExclusiveOfferRequestSchema },
    ]),
  ],
  controllers: [ExclusiveOfferController],
  providers: [ExclusiveOfferService],
  exports: [ExclusiveOfferService],
})
export class ExclusiveOfferModule {}
