import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OfferDocument = Offer & Document;

@Schema({ timestamps: true })
export class Offer {
  @Prop({ required: true })
  reqId: string;

  @Prop({ required: true })
  providerName: string;

  @Prop({ required: true })
  priceGEL: number;

  @Prop({ required: true })
  etaMin: number;

  @Prop({ required: false, default: 0 })
  distanceKm: number;

  @Prop({ type: [String] })
  tags?: string[];

  @Prop()
  partnerId?: string;

  @Prop({ required: true })
  userId: string;

  @Prop({
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  })
  status: string;

  @Prop()
  reminderType?: string; // reminder type: 'service', 'oil', 'tires', 'battery', 'insurance', 'inspection', etc.
}

export const OfferSchema = SchemaFactory.createForClass(Offer);

// Include virtual id and strip __v
OfferSchema.set('toJSON', { virtuals: true, versionKey: false });
