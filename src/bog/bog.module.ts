import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BOGController } from './bog.controller';
import { BOGPaymentService } from './bog-payment.service';
import { BOGOAuthService } from './bog-oauth.service';
import { PaymentsService } from '../payments/payments.service';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import {
  Subscription,
  SubscriptionSchema,
} from '../schemas/subscription.schema';
import { Dismantler, DismantlerSchema } from '../schemas/dismantler.schema';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CarFAXModule } from '../carfax/carfax.module';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Dismantler.name, schema: DismantlerSchema },
    ]),
    SubscriptionsModule,
    CarFAXModule,
    StoresModule,
  ],
  controllers: [BOGController],
  providers: [BOGPaymentService, BOGOAuthService, PaymentsService],
  exports: [BOGPaymentService, BOGOAuthService],
})
export class BOGModule {}
