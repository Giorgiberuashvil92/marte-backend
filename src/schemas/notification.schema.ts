import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

export interface NotificationTarget {
  userId?: string;
  partnerId?: string;
  storeId?: string;
  dismantlerId?: string;
  role?: 'user' | 'partner' | 'store' | 'dismantler';
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true, type: Object })
  target: NotificationTarget;

  @Prop({ required: true, type: Object })
  payload: NotificationPayload;

  @Prop({
    required: true,
    enum: ['request', 'offer', 'message', 'system'],
    default: 'system',
  })
  type: string;

  @Prop({
    required: true,
    enum: ['pending', 'delivered', 'read', 'failed'],
    default: 'pending',
  })
  status: string;

  @Prop()
  deliveredAt?: number;

  @Prop()
  readAt?: number;

  @Prop()
  errorMessage?: string;

  @Prop({ default: Date.now })
  createdAt: number;

  @Prop({ default: Date.now })
  updatedAt: number;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
