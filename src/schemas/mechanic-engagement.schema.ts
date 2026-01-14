import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MechanicEngagementDocument = MechanicEngagement & Document;

@Schema({ timestamps: true })
export class MechanicEngagement {
  @Prop({ required: true, index: true })
  mechanicId: string;

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

export const MechanicEngagementSchema =
  SchemaFactory.createForClass(MechanicEngagement);

// Compound indexes for better query performance
MechanicEngagementSchema.index({ mechanicId: 1, action: 1, timestamp: -1 });
MechanicEngagementSchema.index({ userId: 1, timestamp: -1 });
MechanicEngagementSchema.index({ mechanicId: 1, userId: 1, action: 1 }); // For preventing duplicates

MechanicEngagementSchema.set('toJSON', {
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

