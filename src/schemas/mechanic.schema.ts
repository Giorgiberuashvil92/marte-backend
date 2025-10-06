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
}

export type MechanicDocument = HydratedDocument<Mechanic>;
export const MechanicSchema = SchemaFactory.createForClass(Mechanic);
