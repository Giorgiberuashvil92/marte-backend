import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type LoginHistoryDocument = LoginHistory & Document;

@Schema({ timestamps: true })
export class LoginHistory {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  phone: string;

  @Prop()
  email?: string;

  @Prop()
  firstName?: string;

  @Prop({ required: true })
  loginAt: Date;

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  deviceInfo?: {
    platform?: string;
    deviceName?: string;
    modelName?: string;
    osVersion?: string;
    appVersion?: string;
  };

  @Prop({ default: 'success' })
  status: 'success' | 'failed';

  @Prop()
  failureReason?: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const LoginHistorySchema = SchemaFactory.createForClass(LoginHistory);

// Indexes for better performance
LoginHistorySchema.index({ userId: 1 });
LoginHistorySchema.index({ phone: 1 });
LoginHistorySchema.index({ loginAt: -1 });
LoginHistorySchema.index({ createdAt: -1 });

// Return id instead of _id
LoginHistorySchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (doc: any, ret: any) => {
    if (ret && ret._id) {
      ret.id = ret._id.toString();
      delete ret._id;
    }
    return ret;
  },
});
