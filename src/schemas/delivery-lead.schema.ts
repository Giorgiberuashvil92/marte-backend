import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeliveryLeadDocument = DeliveryLead & Document;

@Schema({ timestamps: true })
export class DeliveryLead {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  address: string;

  @Prop()
  userId?: string;

  @Prop({ default: '' })
  productType: string;

  @Prop({ default: '' })
  productTitle: string;

  @Prop({ default: '' })
  itemDetails: string;

  @Prop({ type: Array, default: [] })
  items: Array<{
    id?: string;
    title?: string;
    quantity?: number;
    price?: number;
  }>;

  @Prop({ default: 0 })
  totalPrice: number;

  @Prop({ default: 'delivery_request' })
  source: string;

  @Prop({ default: 'new' })
  status: string;

  @Prop({ default: '' })
  adminNote: string;
}

export const DeliveryLeadSchema = SchemaFactory.createForClass(DeliveryLead);

DeliveryLeadSchema.set('toJSON', {
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
