import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class FinancingRequest {
  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true })
  phone: string;

  @Prop()
  note?: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

export type FinancingRequestDocument = HydratedDocument<FinancingRequest>;
export const FinancingRequestSchema =
  SchemaFactory.createForClass(FinancingRequest);
