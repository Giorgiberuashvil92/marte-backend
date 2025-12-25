import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { RecurringPaymentsService } from './recurring-payments.service';
import { RecurringPaymentsController } from './recurring-payments.controller';
import { Subscription, SubscriptionSchema } from '../schemas/subscription.schema';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { BOGModule } from '../bog/bog.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
    BOGModule,
    PaymentsModule,
  ],
  controllers: [RecurringPaymentsController],
  providers: [RecurringPaymentsService],
  exports: [RecurringPaymentsService],
})
export class RecurringPaymentsModule {}

