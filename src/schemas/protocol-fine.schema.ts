import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProtocolFineDocument = ProtocolFine & Document;

@Schema({ timestamps: true })
export class ProtocolFine {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  carId: string;

  @Prop({ required: true, index: true })
  vehicleNumber: string;

  @Prop()
  techPassportNumber?: string;

  @Prop({ required: true, index: true })
  protocolNo: string;

  @Prop({ index: true })
  protocolKey: string;

  @Prop()
  agency?: string;

  @Prop({ default: 'municipal', index: true })
  category: 'patrol' | 'municipal';

  @Prop()
  violationDateText?: string;

  @Prop()
  article?: string;

  @Prop()
  description?: string;

  @Prop({ default: false })
  hasMedia: boolean;

  @Prop({ default: false, index: true })
  canPay: boolean;

  @Prop()
  amount?: string;

  @Prop({ type: Object })
  raw?: Record<string, unknown>;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ type: Date })
  firstSeenAt?: Date;

  @Prop({ type: Date, index: true })
  lastSeenAt?: Date;

  @Prop({ type: Date })
  resolvedAt?: Date;
}

export const ProtocolFineSchema = SchemaFactory.createForClass(ProtocolFine);

ProtocolFineSchema.index(
  { userId: 1, carId: 1, protocolKey: 1 },
  { unique: true, partialFilterExpression: { protocolKey: { $exists: true } } },
);
ProtocolFineSchema.index({ userId: 1, carId: 1, isActive: 1 });
