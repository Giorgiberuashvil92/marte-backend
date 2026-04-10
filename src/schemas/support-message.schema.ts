import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { SupportThread } from './support-thread.schema';

export type SupportMessageDocument = SupportMessage & Document;

@Schema({ timestamps: true, collection: 'support_messages' })
export class SupportMessage {
  @Prop({ type: Types.ObjectId, ref: SupportThread.name, required: true })
  threadId: Types.ObjectId;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ type: String, enum: ['user', 'agent'], required: true })
  sender: 'user' | 'agent';

  @Prop({ required: true })
  text: string;

  @Prop({ default: () => Date.now() })
  timestamp: number;
}

export const SupportMessageSchema = SchemaFactory.createForClass(SupportMessage);
SupportMessageSchema.index({ threadId: 1, timestamp: 1 });
SupportMessageSchema.set('toJSON', { virtuals: true, versionKey: false });
