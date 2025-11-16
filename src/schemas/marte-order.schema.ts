import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MarteOrderDocument = MarteOrder & Document;

@Schema({ timestamps: true })
export class MarteOrder {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  carId: string;

  @Prop({
    required: true,
    type: {
      make: { type: String, required: true },
      model: { type: String, required: true },
      year: { type: Number, required: true },
      plate: { type: String, required: true },
    },
  })
  carInfo: {
    make: string;
    model: string;
    year: number;
    plate: string;
  };

  @Prop({
    required: true,
    type: {
      id: { type: String, required: true },
      title: { type: String, required: true },
      price: { type: Number, required: true },
    },
  })
  assistantLevel: {
    id: string;
    title: string;
    price: number;
  };

  @Prop({ required: true })
  problemDescription: string;

  @Prop({
    required: true,
    type: {
      location: { type: String, required: true },
      phone: { type: String, required: true },
      notes: { type: String, required: false },
    },
  })
  contactInfo: {
    location: string;
    phone: string;
    notes?: string;
  };

  @Prop({
    required: true,
    enum: [
      'pending',
      'searching',
      'assigned',
      'in_progress',
      'completed',
      'cancelled',
    ],
    default: 'pending',
  })
  status: string;

  @Prop({
    type: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      phone: { type: String, required: true },
      rating: { type: Number, required: true },
      specialties: [{ type: String }],
    },
    required: false,
  })
  assignedAssistant?: {
    id: string;
    name: string;
    phone: string;
    rating: number;
    specialties: string[];
  };

  @Prop()
  estimatedTime?: string;

  @Prop()
  actualStartTime?: Date;

  @Prop()
  actualEndTime?: Date;

  @Prop()
  totalCost?: number;

  @Prop()
  rating?: number;

  @Prop()
  review?: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const MarteOrderSchema = SchemaFactory.createForClass(MarteOrder);
