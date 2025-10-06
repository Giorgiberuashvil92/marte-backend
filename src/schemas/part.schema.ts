import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PartDocument = Part & Document;

@Schema({ timestamps: true })
export class Part {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true })
  condition: string;

  @Prop({ required: true })
  price: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ required: true })
  seller: string;

  @Prop({ required: true })
  location: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  brand?: string;

  @Prop()
  model?: string;

  @Prop()
  submodel?: string;

  @Prop()
  year?: number;

  @Prop({ default: false })
  isNegotiable: boolean;

  @Prop()
  partNumber?: string;

  @Prop()
  warranty?: string;

  @Prop({ default: 'active' })
  status: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const PartSchema = SchemaFactory.createForClass(Part);
