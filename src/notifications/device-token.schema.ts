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
}

export type DeviceTokenDocument = HydratedDocument<DeviceToken>;
export const DeviceTokenSchema = SchemaFactory.createForClass(DeviceToken);
