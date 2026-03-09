import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Mechanic {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  specialty: string;

  @Prop()
  experience?: string;

  @Prop()
  location?: string;

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  @Prop()
  avatar?: string;

  @Prop({ default: 0 })
  rating?: number;

  @Prop({ default: 0 })
  reviews?: number;

  @Prop({ default: true })
  isAvailable?: boolean;

  @Prop({ type: [String], default: [] })
  services?: string[];

  @Prop()
  description?: string;

  @Prop()
  phone?: string;

  @Prop()
  address?: string;

  @Prop()
  ownerId?: string;

  @Prop({ default: false })
  isFeatured?: boolean; // VIP ხელოსანი

  @Prop({ type: Date })
  expiryDate?: Date; // განცხადების ვადის გასვლის თარიღი (1 თვე შექმნის თარიღიდან)

  @Prop({ default: 'active' })
  status?: string; // active, pending, expired

  @Prop()
  bogCardToken?: string; // BOG order_id recurring payments-ისთვის

  @Prop({ type: Date })
  createdAt?: Date; // Mongoose timestamps: true

  @Prop({ type: Date })
  updatedAt?: Date; // Mongoose timestamps: true
}

export type MechanicDocument = HydratedDocument<Mechanic>;
export const MechanicSchema = SchemaFactory.createForClass(Mechanic);

// Indexes for better performance
MechanicSchema.index({ ownerId: 1 });
MechanicSchema.index({ status: 1 });
MechanicSchema.index({ isFeatured: 1 });
