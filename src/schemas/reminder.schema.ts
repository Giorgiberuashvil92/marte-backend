/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReminderDocument = Reminder & Document;

@Schema({ timestamps: true })
export class Reminder {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  carId: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  priority: string;

  @Prop({ required: true })
  reminderDate: Date;

  @Prop()
  reminderTime?: string;

  @Prop({ default: false })
  isCompleted: boolean;

  @Prop({ default: false })
  isUrgent: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  notificationSentAt?: number;

  @Prop()
  notificationSentDate?: string; // YYYY-MM-DD format, რომ დავადგინოთ დღეში რამდენჯერ გაიგზავნა
}

export const ReminderSchema = SchemaFactory.createForClass(Reminder);

// Return id instead of _id and strip __v
ReminderSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc: any, ret: any) => {
    if (ret && ret._id) {
      ret.id = ret.id || ret._id.toString();
      ret._id = undefined;
    }
    return ret;
  },
});
