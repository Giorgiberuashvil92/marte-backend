import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserLocationDocument = UserLocation & Document;

@Schema({ timestamps: true })
export class UserLocation {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop({ required: true })
  latitude: number;

  @Prop({ required: true })
  longitude: number;

  @Prop()
  address?: string;

  @Prop()
  city?: string;

  @Prop()
  country?: string;

  @Prop()
  postalCode?: string;

  @Prop({ default: Date.now })
  lastUpdated: Date;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const UserLocationSchema = SchemaFactory.createForClass(UserLocation);

// Create indexes for better performance
UserLocationSchema.index({ userId: 1 });
UserLocationSchema.index({ latitude: 1, longitude: 1 });
