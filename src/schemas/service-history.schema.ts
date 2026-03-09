import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ServiceHistoryDocument = ServiceHistory & Document;

@Schema({ timestamps: true })
export class ServiceHistory {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  carId: string;

  @Prop({ required: true })
  serviceType: string; // 'oil_change', 'tire_change', 'inspection', 'repair', 'other'

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  mileage: number;

  @Prop()
  cost?: number; // ღირებულება

  @Prop()
  description?: string; // აღწერა

  @Prop()
  provider?: string; // სად გაკეთდა (სერვისის შემსრულებელი)

  @Prop()
  location?: string; // მდებარეობა

  @Prop({ type: [String], default: [] })
  images?: string[]; // სერვისის ფოტოები/რეცეპტები

  @Prop()
  warrantyUntil?: Date; // გარანტია სადამდე

  @Prop({ default: true })
  isActive: boolean;
}

export const ServiceHistorySchema =
  SchemaFactory.createForClass(ServiceHistory);

ServiceHistorySchema.set('toJSON', {
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

// Indexes for better query performance
ServiceHistorySchema.index({ userId: 1, carId: 1 });
ServiceHistorySchema.index({ carId: 1, date: -1 });
ServiceHistorySchema.index({ userId: 1, date: -1 });
