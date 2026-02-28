import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EcommerceProductDocument = EcommerceProduct & Document;

@Schema({ timestamps: true })
export class EcommerceProduct {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  price: number; // ფასი GEL-ში

  @Prop()
  originalPrice?: number; // ძველი ფასი (ფასდაკლებისთვის)

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ required: true })
  category: string; // კატეგორია: 'parts', 'oils', 'accessories', 'interior', 'tools', 'electronics'

  @Prop()
  brand?: string; // ბრენდი

  @Prop()
  sku?: string; // SKU კოდი

  @Prop({ default: 0 })
  stock: number; // საწყობში რაოდენობა

  @Prop({ default: true })
  inStock: boolean; // არის თუ არა საწყობში

  @Prop({ default: true })
  isActive: boolean; // აქტიურია თუ არა

  @Prop({ default: false })
  isFeatured: boolean; // გამორჩეული პროდუქტი

  @Prop({ default: 0 })
  views: number; // ნახვების რაოდენობა

  @Prop({ default: 0 })
  sales: number; // გაყიდვების რაოდენობა

  @Prop({ type: Object })
  specifications?: Record<string, any>; // დამატებითი მახასიათებლები

  @Prop({ type: [String], default: [] })
  tags?: string[]; // ტეგები

  @Prop()
  createdBy?: string; // ადმინის ID, ვინ შექმნა
}

export const EcommerceProductSchema = SchemaFactory.createForClass(EcommerceProduct);
