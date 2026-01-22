import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { Request, RequestSchema } from '../schemas/request.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Offer, OfferSchema } from '../schemas/offer.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Request.name, schema: RequestSchema },
      { name: User.name, schema: UserSchema },
      { name: Offer.name, schema: OfferSchema },
    ]),
    NotificationsModule,
    AIModule,
  ],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
