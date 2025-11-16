import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ required: true, unique: true })
  requestId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  partnerId: string;

  @Prop({ type: String })
  lastMessage?: string;

  @Prop({ type: Number })
  lastMessageAt?: number;

  @Prop({
    type: Object,
    default: () => ({ user: 0, partner: 0 }),
  })
  unreadCounts: { user: number; partner: number };
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ userId: 1, lastMessageAt: -1 });
ConversationSchema.index({ partnerId: 1, lastMessageAt: -1 });
// requestId already has unique index from @Prop({ unique: true })
