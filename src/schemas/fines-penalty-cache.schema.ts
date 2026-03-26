import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FinesPenaltyCacheDocument = FinesPenaltyCache & Document;

@Schema({ timestamps: true })
export class FinesPenaltyCache {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  vehicleNumber: string; // normalized: MI999SS

  @Prop({ required: true })
  techPassportNumber: string;

  @Prop({ required: true, index: true })
  protocolId: number;

  @Prop()
  penaltyNumber?: string;

  @Prop()
  penaltyTypeName?: string;

  @Prop()
  finalAmount?: number;

  @Prop({ default: false, index: true })
  isPayable: boolean;

  @Prop()
  violationDate?: string;

  @Prop()
  fineDate?: string;

  @Prop()
  penaltyDate?: string;

  @Prop({ type: Object })
  raw?: Record<string, unknown>;

  @Prop({ default: true, index: true })
  isActive: boolean; // ჩანს ბოლო სინქში თუ არა

  @Prop({ type: Date })
  firstSeenAt?: Date;

  @Prop({ type: Date, index: true })
  lastSeenAt?: Date;

  @Prop({ type: Date })
  resolvedAt?: Date;
}

export const FinesPenaltyCacheSchema =
  SchemaFactory.createForClass(FinesPenaltyCache);

// ერთი და იგივე user/vehicle/protocol ერთ ჩანაწერად ვინახოთ
FinesPenaltyCacheSchema.index(
  { userId: 1, vehicleNumber: 1, protocolId: 1 },
  { unique: true },
);
