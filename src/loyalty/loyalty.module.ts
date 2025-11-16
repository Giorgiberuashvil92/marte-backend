import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Loyalty, LoyaltySchema } from '../schemas/loyalty.schema';
import {
  LoyaltyTransaction,
  LoyaltyTransactionSchema,
} from '../schemas/loyalty-transaction.schema';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { Referral, ReferralSchema } from '../schemas/referral.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Loyalty.name, schema: LoyaltySchema },
      { name: LoyaltyTransaction.name, schema: LoyaltyTransactionSchema },
      { name: Referral.name, schema: ReferralSchema },
    ]),
  ],
  providers: [LoyaltyService],
  controllers: [LoyaltyController],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
