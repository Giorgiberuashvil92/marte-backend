import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CarFAXReportDocument = CarFAXReport & Document;

@Schema({ timestamps: true })
export class CarFAXReport {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, unique: true })
  vin: string;

  @Prop({ required: true })
  make: string;

  @Prop({ required: true })
  model: string;

  @Prop({ required: true })
  year: number;

  @Prop()
  mileage?: number;

  @Prop({ default: 0 })
  accidents: number;

  @Prop({ default: 1 })
  owners: number;

  @Prop({ default: 0 })
  serviceRecords: number;

  @Prop({ default: 'Clean' })
  titleStatus: string;

  @Prop()
  lastServiceDate?: string;

  @Prop({ required: true })
  reportId: string;

  @Prop({ type: Object })
  reportData?: any; // Raw API response data

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const CarFAXReportSchema = SchemaFactory.createForClass(CarFAXReport);
