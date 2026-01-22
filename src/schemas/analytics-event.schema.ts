import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AnalyticsEventDocument = AnalyticsEvent & Document;

@Schema({ timestamps: true })
export class AnalyticsEvent {
  @Prop({ index: true })
  userId?: string;

  @Prop({ required: true, index: true })
  eventType: string; // 'screen_view', 'button_click', 'navigation', etc.

  @Prop({ required: true })
  eventName: string; // 'მთავარი', 'რეფერალური პროგრამა', etc.

  @Prop()
  screen?: string; // Screen where event occurred

  @Prop({ type: Object })
  params?: Record<string, any>; // Additional parameters

  @Prop({ default: Date.now, index: true })
  timestamp: number;
}

export const AnalyticsEventSchema =
  SchemaFactory.createForClass(AnalyticsEvent);

// Indexes for better query performance
AnalyticsEventSchema.index({ eventType: 1, timestamp: -1 });
AnalyticsEventSchema.index({ userId: 1, timestamp: -1 });
AnalyticsEventSchema.index({ eventName: 1, timestamp: -1 });
