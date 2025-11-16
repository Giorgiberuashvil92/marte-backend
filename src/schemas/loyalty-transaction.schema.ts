import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LoyaltyTransactionDocument = HydratedDocument<LoyaltyTransaction>;

@Schema({ timestamps: true })
export class LoyaltyTransaction {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, enum: ['earned', 'spent', 'bonus'] })
  type: 'earned' | 'spent' | 'bonus';

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  description: string;

  @Prop()
  service?: string;

  @Prop({ default: () => Date.now() })
  ts: number;

  @Prop({ default: 'pricetag' })
  icon: string;
}

export const LoyaltyTransactionSchema =
  SchemaFactory.createForClass(LoyaltyTransaction);
LoyaltyTransactionSchema.index({ userId: 1, ts: -1 });
