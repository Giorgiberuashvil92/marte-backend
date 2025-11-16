import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StoryDocument = Story & Document;

@Schema({ _id: true, timestamps: true })
export class Story {
  @Prop({ required: true })
  authorId: string;

  @Prop({ required: true })
  authorName: string;

  @Prop()
  authorAvatar?: string;

  @Prop({ default: false })
  highlight?: boolean;

  @Prop({ enum: ['my-car', 'friends', 'services'], default: 'services' })
  category?: string;

  @Prop({ type: Array, default: [] })
  items: Array<{
    id: string;
    type: 'image' | 'video';
    uri: string;
    durationMs?: number;
    caption?: string;
    poll?: {
      id: string;
      question: string;
      options: Array<{ id: string; label: string; votes: number }>;
    };
  }>;

  @Prop({ required: true })
  createdAt: number;

  @Prop({ required: true })
  updatedAt: number;

  @Prop({ required: true, default: 0 })
  viewsCount: number;

  @Prop({ type: [{ userId: String, viewedAt: Number }], default: [] })
  viewers: Array<{ userId: string; viewedAt: number }>;
}

export const StorySchema = SchemaFactory.createForClass(Story);
