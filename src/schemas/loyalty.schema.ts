import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LoyaltyDocument = HydratedDocument<Loyalty>;

@Schema({ timestamps: true })
export class Loyalty {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, default: 0 })
  points: number;

  @Prop({ required: true, default: 0 })
  streakDays: number;

  @Prop({ required: true, default: Date.now })
  updatedAt: number;
}

export const LoyaltySchema = SchemaFactory.createForClass(Loyalty);
LoyaltySchema.index({ userId: 1 }, { unique: true });
