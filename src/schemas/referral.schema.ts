import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ReferralDocument = HydratedDocument<Referral>;

@Schema({ timestamps: true })
export class Referral {
  @Prop({ required: true, index: true })
  inviteeId: string; // who used the code

  @Prop({ required: true, index: true })
  inviterId: string; // owner of the code

  @Prop({ default: Date.now })
  appliedAt: number;

  @Prop({ default: false })
  subscriptionEnabled: boolean;

  @Prop()
  firstBookingAt?: number;

  @Prop({ default: false })
  rewardsGranted: boolean;
}

export const ReferralSchema = SchemaFactory.createForClass(Referral);
ReferralSchema.index({ inviteeId: 1 }, { unique: true });
