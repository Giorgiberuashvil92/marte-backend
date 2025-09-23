import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ required: true })
  offerId: string;

  @Prop({ type: String, enum: ['user', 'partner'], required: true })
  author: 'user' | 'partner';

  @Prop({ required: true })
  text: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Simplify JSON output
MessageSchema.set('toJSON', { virtuals: true, versionKey: false });
