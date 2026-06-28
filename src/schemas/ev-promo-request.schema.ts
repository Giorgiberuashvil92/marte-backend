import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EvPromoRequestStatus = 'pending' | 'assigned';

@Schema({ timestamps: true })
export class EvPromoRequest {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({
    required: true,
    enum: ['pending', 'assigned'],
    default: 'pending',
    index: true,
  })
  status: EvPromoRequestStatus;

  @Prop()
  promoCode?: string;

  @Prop({ default: 'https://evpower.ge' })
  websiteUrl?: string;

  @Prop()
  userPhone?: string;

  @Prop()
  userName?: string;

  @Prop()
  assignedAt?: Date;

  @Prop()
  assignedBy?: string;

  @Prop()
  notes?: string;
}

export type EvPromoRequestDocument = HydratedDocument<EvPromoRequest>;
export const EvPromoRequestSchema =
  SchemaFactory.createForClass(EvPromoRequest);
