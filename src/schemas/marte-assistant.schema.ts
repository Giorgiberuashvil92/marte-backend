import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MarteAssistantDocument = MarteAssistant & Document;

@Schema({ timestamps: true })
export class MarteAssistant {
  @Prop({ required: true, unique: true })
  phone: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop({
    required: true,
    type: {
      id: { type: String, required: true },
      title: { type: String, required: true },
      hourlyRate: { type: Number, required: true },
    },
  })
  level: {
    id: string;
    title: string;
    hourlyRate: number;
  };

  @Prop({ required: true })
  specialties: string[];

  @Prop({
    required: true,
    type: {
      city: { type: String, required: true },
      district: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    },
  })
  location: {
    city: string;
    district: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };

  @Prop({
    required: true,
    enum: ['available', 'busy', 'offline'],
    default: 'available',
  })
  status: string;

  @Prop({ default: 0 })
  totalOrders: number;

  @Prop({ default: 0 })
  completedOrders: number;

  @Prop({ default: 5.0 })
  rating: number;

  @Prop({ default: 0 })
  totalRatings: number;

  @Prop()
  profileImage?: string;

  @Prop({
    type: {
      idCard: { type: String, required: true },
      driverLicense: { type: String, required: true },
      insurance: { type: String, required: true },
    },
    required: false,
  })
  documents?: {
    idCard: string;
    driverLicense: string;
    insurance: string;
  };

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const MarteAssistantSchema =
  SchemaFactory.createForClass(MarteAssistant);
