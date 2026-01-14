import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StoreEngagementDocument = StoreEngagement & Document;

@Schema({ timestamps: true })
export class StoreEngagement {
  @Prop({ required: true, index: true })
  storeId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop()
  userName?: string;

  @Prop()
  userPhone?: string;

  @Prop()
  userEmail?: string;

  @Prop({
    required: true,
    enum: ['like', 'view', 'call'],
    index: true,
  })
  action: string;

  @Prop({ default: Date.now, index: true })
  timestamp: Date;
}

export const StoreEngagementSchema =
  SchemaFactory.createForClass(StoreEngagement);

// Compound indexes for better query performance
StoreEngagementSchema.index({ storeId: 1, action: 1, timestamp: -1 });
StoreEngagementSchema.index({ userId: 1, timestamp: -1 });
StoreEngagementSchema.index({ storeId: 1, userId: 1, action: 1 }); 

StoreEngagementSchema.set('toJSON', {
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


