import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class DeviceToken {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, unique: true })
  token: string;

  @Prop({ default: 'expo' })
  provider: string;

  @Prop({ default: 'unknown' })
  platform: string;

  @Prop({ type: Object, required: false })
  deviceInfo?: {
    deviceName?: string | null;
    modelName?: string | null;
    brand?: string | null;
    manufacturer?: string | null;
    osName?: string | null;
    osVersion?: string | null;
    deviceType?: string | null;
    totalMemory?: number | null;
    appVersion?: string | null;
    appBuildNumber?: string | null;
    platform?: string | null;
    platformVersion?: string | null;
  };
}

export type DeviceTokenDocument = HydratedDocument<DeviceToken>;
export const DeviceTokenSchema = SchemaFactory.createForClass(DeviceToken);
