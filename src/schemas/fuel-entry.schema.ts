import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FuelEntryDocument = FuelEntry & Document;

@Schema({ timestamps: true })
export class FuelEntry {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  carId: string;

  @Prop({ required: true })
  date: string;

  @Prop({ required: true })
  liters: number;

  @Prop({ required: true })
  pricePerLiter: number;

  @Prop({ required: true })
  totalPrice: number;

  @Prop({ required: true })
  mileage: number;
}

export const FuelEntrySchema = SchemaFactory.createForClass(FuelEntry);

// Return id instead of _id and strip __v
FuelEntrySchema.set('toJSON', {
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
