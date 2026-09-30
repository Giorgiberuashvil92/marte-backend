import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReviewDocument = Review & Document;

@Schema({ timestamps: true })
export class Review {
  @Prop({ required: true }) message: string;
  @Prop() userId?: string;
  @Prop() userName?: string;
  @Prop() phone?: string;
  @Prop() source?: string;
  @Prop({ min: 1, max: 5 }) rating?: number;
  @Prop() category?: string;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

ReviewSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc: any, ret: any) => {
    if (ret?._id) {
      ret.id = ret.id || ret._id.toString();
      ret._id = undefined;
    }
    return ret;
  },
});
