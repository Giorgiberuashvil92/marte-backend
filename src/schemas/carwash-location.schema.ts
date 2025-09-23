import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CarwashLocationDocument = CarwashLocation & Document;

export class CarwashService {
  id: string;
  name: string;
  price: number;
  duration: number; // წუთებში
  description?: string;
}

export class TimeSlot {
  time: string;
  available: boolean;
  bookedBy?: string;
}

export class DaySlots {
  date: string;
  slots: TimeSlot[];
}

export class WorkingDay {
  day: string; // monday, tuesday, etc.
  startTime: string;
  endTime: string;
  isWorking: boolean;
}

export class BreakTime {
  start: string;
  end: string;
  name: string;
}

export class TimeSlotsConfig {
  workingDays: WorkingDay[];
  interval: number; // წუთებში (30, 60, etc.)
  breakTimes: BreakTime[];
}

export class RealTimeStatus {
  isOpen: boolean;
  currentWaitTime: number; // წუთებში
  currentQueue: number;
  estimatedWaitTime: number; // წუთებში
  lastStatusUpdate: number;
}

export class SocialMedia {
  facebook?: string;
  instagram?: string;
  website?: string;
  twitter?: string;
  tiktok?: string;
}

@Schema({ timestamps: true })
export class CarwashLocation {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true })
  location: string;

  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true, default: 0 })
  rating: number;

  @Prop({ required: true, default: 0 })
  reviews: number;

  @Prop({ required: true })
  services: string; // ძველი ველი - backward compatibility

  @Prop({ type: [Object], required: true })
  detailedServices: CarwashService[]; // ახალი დეტალური სერვისები

  @Prop()
  features?: string;

  @Prop({ required: true })
  workingHours: string; // ძველი ველი - backward compatibility

  @Prop({ type: Object, required: true })
  timeSlotsConfig: TimeSlotsConfig; // ახალი დროის სლოტების კონფიგურაცია

  @Prop({ type: [Object], required: true })
  availableSlots: DaySlots[]; // ხელმისაწვდომი სლოტები

  @Prop({ type: Object, required: true })
  realTimeStatus: RealTimeStatus; // რეალური დროის სტატუსი

  @Prop({ type: [String] })
  images?: string[];

  @Prop({ required: true })
  description: string;

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  @Prop({ required: true })
  isOpen: boolean; // ძველი ველი - backward compatibility

  @Prop({ required: true })
  ownerId: string;

  @Prop({ type: Object })
  socialMedia?: SocialMedia; // სოციალური მედია

  // MongoDB timestamps (automatic)
  createdAt?: number;
  updatedAt?: number;
}

export const CarwashLocationSchema =
  SchemaFactory.createForClass(CarwashLocation);

// Indexes for better performance
CarwashLocationSchema.index({ latitude: 1, longitude: 1 });
CarwashLocationSchema.index({ isOpen: 1 });
CarwashLocationSchema.index({ rating: -1 });
CarwashLocationSchema.index({ ownerId: 1 });

// Return id instead of _id and strip __v
CarwashLocationSchema.set('toJSON', {
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
