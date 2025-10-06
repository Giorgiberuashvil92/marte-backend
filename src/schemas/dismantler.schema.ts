import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DismantlerDocument = Dismantler & Document;

@Schema({ timestamps: true })
export class Dismantler {
  @Prop({ required: true })
  brand: string;

  @Prop({ required: true })
  model: string;

  @Prop({ required: true })
  yearFrom: number;

  @Prop({ required: true })
  yearTo: number;

  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  location: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: Object, default: {} })
  contactInfo: {
    name?: string;
    email?: string;
  };

  @Prop({ default: 'pending' })
  status: string;

  @Prop({ default: 0 })
  views: number;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ required: true })
  ownerId: string;
}

export const DismantlerSchema = SchemaFactory.createForClass(Dismantler);
