import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  planId: string;

  @Prop({ required: true })
  planName: string;

  @Prop({ required: true })
  planPrice: number;

  @Prop({ required: true, default: 'GEL' })
  currency: string;

  @Prop({ required: true })
  period: string; // 'monthly', 'yearly', 'lifetime'

  @Prop({
    required: true,
    enum: ['active', 'cancelled', 'expired', 'pending'],
    default: 'pending',
  })
  status: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop()
  endDate?: Date;

  @Prop()
  nextBillingDate?: Date;

  @Prop()
  paymentMethod?: string;

  @Prop()
  transactionId?: string;

  @Prop()
  orderId?: string;

  @Prop({ default: 0 })
  totalPaid: number;

  @Prop({ default: 0 })
  billingCycles: number;

  @Prop({ type: Object })
  features?: {
    [key: string]: any;
  };

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;

  @Prop()
  bogCardToken?: string; // BOG-ის დამახსოვრებული ბარათის token
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
