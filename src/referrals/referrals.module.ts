import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { User, UserSchema } from '../schemas/user.schema';
import { Referral, ReferralSchema } from '../schemas/referral.schema';
import { Loyalty, LoyaltySchema } from '../schemas/loyalty.schema';
import {
  LoyaltyTransaction,
  LoyaltyTransactionSchema,
} from '../schemas/loyalty-transaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Referral.name, schema: ReferralSchema },
      { name: Loyalty.name, schema: LoyaltySchema },
      { name: LoyaltyTransaction.name, schema: LoyaltyTransactionSchema },
    ]),
  ],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
