import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ExternalPartDocument = ExternalPart & Document;

@Schema({ timestamps: true })
export class ExternalPart {
  @Prop({ required: true, index: true })
  source: string;

  @Prop({ required: true, index: true })
  sourceProductId: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true })
  price: string;

  @Prop({ default: 3 })
  currencyId: number;

  @Prop({ default: 0 })
  categoryId: number;

  @Prop({ default: 0 })
  conditionTypeId: number;

  @Prop({ default: 0 })
  locationId: number;

  @Prop({ default: '' })
  shopName: string;

  @Prop({ default: '' })
  sellerName: string;

  @Prop({ default: 0, index: true })
  makeId: number;

  @Prop({ type: [Number], default: [], index: true })
  modelIds: number[];

  @Prop({ type: Object, default: [] })
  modelCompatibility: Array<{
    makeId: number;
    modelId: number;
    yearFrom?: number;
    yearTo?: number;
  }>;

  @Prop()
  image?: string;

  @Prop()
  thumbnail?: string;

  @Prop({ type: Object, default: [] })
  photos: Array<{
    large: string;
    thumbnail: string;
  }>;

  @Prop({ required: true })
  sourceUrl: string;

  @Prop({ default: Date.now })
  lastFetchedAt: Date;
}

export const ExternalPartSchema = SchemaFactory.createForClass(ExternalPart);

ExternalPartSchema.index({ source: 1, sourceProductId: 1 }, { unique: true });
