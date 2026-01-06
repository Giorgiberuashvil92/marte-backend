import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FeedbackDocument = Feedback & Document;

@Schema({ timestamps: true })
export class Feedback {
  @Prop({ required: true })
  message: string;

  @Prop()
  userId?: string;

  @Prop()
  userName?: string;

  @Prop()
  phone?: string;

  @Prop()
  source?: string;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);

FeedbackSchema.set('toJSON', {
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
