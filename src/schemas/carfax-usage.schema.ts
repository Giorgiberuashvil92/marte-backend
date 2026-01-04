import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CarFAXUsageDocument = CarFAXUsage & Document;

@Schema({ timestamps: true })
export class CarFAXUsage {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop({ default: 5 })
  totalLimit: number; // მთლიანი ლიმიტი (5 ცალი)

  @Prop({ default: 0 })
  used: number; // გამოყენებული რაოდენობა

  @Prop({ default: Date.now })
  lastResetAt: Date; // ბოლო განახლების თარიღი

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const CarFAXUsageSchema = SchemaFactory.createForClass(CarFAXUsage);

