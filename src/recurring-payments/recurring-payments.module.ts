import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecurringPaymentsService } from './recurring-payments.service';
import { RecurringPaymentsController } from './recurring-payments.controller';
import {
  Subscription,
  SubscriptionSchema,
} from '../schemas/subscription.schema';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Dismantler, DismantlerSchema } from '../schemas/dismantler.schema';
import { BOGModule } from '../bog/bog.module';
import { PaymentsModule } from '../payments/payments.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import {
  CarFinesSubscription,
  CarFinesSubscriptionSchema,
} from '../schemas/car-fines-subscription.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: User.name, schema: UserSchema },
      { name: Dismantler.name, schema: DismantlerSchema },
      {
        name: CarFinesSubscription.name,
        schema: CarFinesSubscriptionSchema,
      },
    ]),
    BOGModule,
    PaymentsModule,
    SubscriptionsModule,
  ],
  controllers: [RecurringPaymentsController],
  providers: [RecurringPaymentsService],
  exports: [RecurringPaymentsService],
})
export class RecurringPaymentsModule {}
