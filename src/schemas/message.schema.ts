import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ required: true })
  requestId: string;

  @Prop({ required: true })
  userId: string;

  @Prop()
  partnerId?: string;

  @Prop({ type: String, enum: ['user', 'partner'], required: true })
  sender: 'user' | 'partner';

  @Prop({ required: true })
  message: string;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ default: Date.now })
  timestamp: number;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Add indexes for better performance
MessageSchema.index({ requestId: 1, timestamp: -1 });
MessageSchema.index({ userId: 1 });
MessageSchema.index({ partnerId: 1 });

// Simplify JSON output
MessageSchema.set('toJSON', { virtuals: true, versionKey: false });
