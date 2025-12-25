import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BOGController } from './bog.controller';
import { BOGPaymentService } from './bog-payment.service';
import { BOGOAuthService } from './bog-oauth.service';
import { PaymentsService } from '../payments/payments.service';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    SubscriptionsModule,
  ],
  controllers: [BOGController],
  providers: [BOGPaymentService, BOGOAuthService, PaymentsService],
  exports: [BOGPaymentService, BOGOAuthService],
})
export class BOGModule {}
