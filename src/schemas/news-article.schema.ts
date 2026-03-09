import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NewsArticleDocument = NewsArticle & Document;

@Schema({ timestamps: true })
export class NewsArticle {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  summary: string;

  @Prop({ default: 'general' })
  category: string; // e.g. 'technology', 'tips', 'general'

  @Prop()
  image?: string;

  @Prop({ default: 0 })
  views: number;

  @Prop({ default: 0 })
  likes: number;

  @Prop({ default: Date.now })
  publishedAt: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  body?: string; // optional full article body
}

export const NewsArticleSchema = SchemaFactory.createForClass(NewsArticle);

NewsArticleSchema.index({ isActive: 1, publishedAt: -1 });
NewsArticleSchema.index({ category: 1 });

NewsArticleSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc: any, ret: any) => {
    if (ret && ret._id) {
      ret.id = ret._id.toString();
      ret._id = undefined;
    }
    if (ret.publishedAt && ret.publishedAt instanceof Date) {
      ret.publishedAt = ret.publishedAt.toISOString();
    }
    return ret;
  },
});
