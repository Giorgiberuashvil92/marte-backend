import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class FinancingLead {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  requestId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  phone: string;

  @Prop()
  merchantPhone?: string;

  @Prop()
  downPayment?: number;

  @Prop()
  termMonths?: number;

  @Prop()
  personalId?: string;

  @Prop()
  note?: string;

  @Prop({ type: Date, default: Date.now })
  createdAt?: Date;
}

export type FinancingLeadDocument = HydratedDocument<FinancingLead>;
export const FinancingLeadSchema = SchemaFactory.createForClass(FinancingLead);
