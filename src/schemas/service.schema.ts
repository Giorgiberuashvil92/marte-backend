import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ServiceDocument = Service & Document;

@Schema({ timestamps: true })
export class Service {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  category: string; // 'ავტოსერვისი', 'სამრეცხაო', etc.

  @Prop({ required: true })
  location: string;

  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  price?: string | number;

  @Prop({ default: 0 })
  rating: number;

  @Prop({ default: 0 })
  reviews: number;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop()
  avatar?: string;

  @Prop({ type: [String], default: [] })
  services: string[]; // სერვისების სია

  @Prop()
  features?: string;

  @Prop({ default: true })
  isOpen: boolean;

  @Prop()
  waitTime?: string;

  @Prop()
  workingHours?: string;

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  @Prop()
  ownerId?: string;

  @Prop({ default: 'active' })
  status: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);

// Indexes for better performance
ServiceSchema.index({ category: 1 });
ServiceSchema.index({ location: 1 });
ServiceSchema.index({ isOpen: 1 });
ServiceSchema.index({ rating: -1 });
ServiceSchema.index({ ownerId: 1 });

// Return id instead of _id and strip __v
ServiceSchema.set('toJSON', {
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
