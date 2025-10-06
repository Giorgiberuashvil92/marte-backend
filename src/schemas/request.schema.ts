import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RequestDocument = Request & Document;

@Schema({ timestamps: true })
export class Vehicle {
  @Prop({ required: true })
  make: string;

  @Prop({ required: true })
  model: string;

  @Prop({ required: true })
  year: string;
}

export const VehicleSchema = SchemaFactory.createForClass(Vehicle);

@Schema({ timestamps: true })
export class Request {
  @Prop({ required: true })
  userId: string;

  @Prop({ type: VehicleSchema, required: true })
  vehicle: Vehicle;

  @Prop({ required: true })
  partName: string;

  @Prop()
  brand?: string;

  @Prop()
  budgetGEL?: number;

  @Prop()
  distanceKm?: number;

  @Prop({
    type: String,
    enum: ['active', 'fulfilled', 'cancelled'],
    default: 'active',
  })
  status: string;

  @Prop()
  description?: string;

  @Prop({
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  })
  urgency: string;

  @Prop({
    type: String,
    enum: ['parts', 'mechanic', 'tow', 'rental'],
    required: false,
  })
  service?: string;
}

export const RequestSchema = SchemaFactory.createForClass(Request);

// Return id instead of _id and strip __v
RequestSchema.set('toJSON', {
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
