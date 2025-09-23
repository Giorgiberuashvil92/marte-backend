/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CarwashBookingDocument = CarwashBooking & Document;

@Schema({ timestamps: true })
export class CarInfo {
  @Prop({ required: true })
  make: string;

  @Prop({ required: true })
  model: string;

  @Prop({ required: true })
  year: string;

  @Prop({ required: true })
  licensePlate: string;

  @Prop()
  color?: string;
}

export const CarInfoSchema = SchemaFactory.createForClass(CarInfo);

@Schema({ timestamps: true })
export class CustomerInfo {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phone: string;

  @Prop()
  email?: string;
}

export const CustomerInfoSchema = SchemaFactory.createForClass(CustomerInfo);

@Schema({ timestamps: true })
export class CarwashBooking {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  locationId: string;

  @Prop({ required: true })
  locationName: string;

  @Prop({ required: true })
  locationAddress: string;

  @Prop({ required: true })
  serviceId: string;

  @Prop({ required: true })
  serviceName: string;

  @Prop()
  servicePrice: number;

  @Prop()
  bookingDate: number;

  @Prop()
  bookingTime: string;

  @Prop({ type: CarInfoSchema, required: true })
  carInfo: CarInfo;

  @Prop({ type: CustomerInfoSchema, required: true })
  customerInfo: CustomerInfo;

  @Prop()
  notes?: string;

  @Prop()
  estimatedDuration?: number;

  @Prop({ type: [String] })
  specialRequests?: string[];

  @Prop({
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
  })
  status: string;
}

export const CarwashBookingSchema =
  SchemaFactory.createForClass(CarwashBooking);

// Return id instead of _id and strip __v
CarwashBookingSchema.set('toJSON', {
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

// Enforce bookingDate/bookingTime only on create
CarwashBookingSchema.pre('save', function (next) {
  const doc: any = this as any;
  if (doc.isNew) {
    if (!doc.bookingDate || !doc.bookingTime) {
      return next(
        new Error('bookingDate and bookingTime are required on create'),
      );
    }
  }
  next();
});
