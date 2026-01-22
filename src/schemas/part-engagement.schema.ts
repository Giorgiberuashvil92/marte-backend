import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PartEngagementDocument = PartEngagement & Document;

@Schema({ timestamps: true })
export class PartEngagement {
  @Prop({ required: true, index: true })
  partId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop()
  userName?: string;

  @Prop()
  userPhone?: string;

  @Prop()
  userEmail?: string;

  @Prop({
    required: true,
    enum: ['like', 'view', 'call'],
    index: true,
  })
  action: string;

  @Prop({ default: Date.now, index: true })
  timestamp: Date;
}

export const PartEngagementSchema =
  SchemaFactory.createForClass(PartEngagement);

// Indexes for better query performance
PartEngagementSchema.index({ partId: 1, userId: 1, action: 1 });
PartEngagementSchema.index({ partId: 1, action: 1 });
