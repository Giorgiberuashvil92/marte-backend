import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ExclusiveOfferRequestDocument = ExclusiveOfferRequest & Document;

/**
 * ექსკლუზიური შეთავაზება (მაგ. პორტალის ბარათი / საწვავის აქცია) — განაცხადები ადმინიდან სანახავად.
 */
@Schema({ timestamps: true })
export class ExclusiveOfferRequest {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true })
  personalId: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  email: string;

  @Prop()
  userId?: string;

  /** მაგ. fuel_exclusive_portal */
  @Prop({ default: 'fuel_exclusive_portal' })
  source: string;
}

export const ExclusiveOfferRequestSchema = SchemaFactory.createForClass(
  ExclusiveOfferRequest,
);

ExclusiveOfferRequestSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc: any, ret: any) => {
    if (ret && ret._id) {
      ret.id = ret.id || ret._id.toString();
      ret._id = undefined;
    }
    return ret;
  },
});
