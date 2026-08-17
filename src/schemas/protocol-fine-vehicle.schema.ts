import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProtocolFineVehicleDocument = ProtocolFineVehicle & Document;

@Schema({ timestamps: true })
export class ProtocolFineVehicle {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  carId: string;

  @Prop({ required: true, index: true })
  vehicleNumber: string;

  @Prop()
  techPassportNumber?: string;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ default: 'pending', index: true })
  lastSyncStatus: 'success' | 'not_found' | 'failed' | 'pending' | 'refresh_due';

  @Prop()
  lastError?: string;

  @Prop({ type: Date, index: true })
  lastCheckedAt?: Date;

  @Prop({ type: Date, index: true })
  refreshDueAt?: Date;
}

export const ProtocolFineVehicleSchema =
  SchemaFactory.createForClass(ProtocolFineVehicle);

ProtocolFineVehicleSchema.index({ userId: 1, carId: 1 }, { unique: true });
ProtocolFineVehicleSchema.index({ vehicleNumber: 1, techPassportNumber: 1 });
