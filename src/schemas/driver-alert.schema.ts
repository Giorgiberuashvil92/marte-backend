import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DriverAlertDocument = DriverAlert & Document;

@Schema({ timestamps: true })
export class DriverAlert {
  @Prop() userId?: string;

  @Prop({ required: true, maxlength: 120 })
  title: string;

  @Prop({ maxlength: 500 })
  description?: string;

  @Prop({ type: String, enum: ['traffic', 'accident', 'radar', 'roadwork', 'other'], default: 'other', index: true })
  type: string;

  @Prop() location?: string;
  @Prop() latitude?: number;
  @Prop() longitude?: number;
  @Prop({ default: true, index: true }) isActive: boolean;
  @Prop() expiresAt?: Date;
}

export const DriverAlertSchema = SchemaFactory.createForClass(DriverAlert);

DriverAlertSchema.set('toJSON', {
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
