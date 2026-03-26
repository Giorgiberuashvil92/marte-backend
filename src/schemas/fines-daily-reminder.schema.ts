import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FinesDailyReminderDocument = FinesDailyReminder & Document;

/**
 */
@Schema({ timestamps: true })
export class FinesDailyReminder {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  ymd: string;

  @Prop({ type: [String], default: [] })
  slots: string[];
}

export const FinesDailyReminderSchema =
  SchemaFactory.createForClass(FinesDailyReminder);

FinesDailyReminderSchema.index({ userId: 1, ymd: 1 }, { unique: true });
