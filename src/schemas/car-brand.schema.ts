import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class CarBrand {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop()
  country?: string;

  @Prop()
  logo?: string;

  @Prop({ type: [String], default: [] })
  models: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  order: number;
}

export type CarBrandDocument = CarBrand & Document;
export const CarBrandSchema = SchemaFactory.createForClass(CarBrand);
