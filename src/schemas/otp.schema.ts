import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OtpDocument = Otp & Document;

@Schema({ timestamps: true })
export class Otp {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  expiresAt: number;

  @Prop({ required: true, default: false })
  isUsed: boolean;

  @Prop()
  usedAt?: number;

  @Prop({ required: true })
  createdAt: number;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);

// Indexes for better performance
OtpSchema.index({ phone: 1 });
OtpSchema.index({ expiresAt: 1 });
OtpSchema.index({ isUsed: 1 });
OtpSchema.index({ createdAt: -1 });
