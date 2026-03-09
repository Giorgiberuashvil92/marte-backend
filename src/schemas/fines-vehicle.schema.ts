import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FinesVehicleDocument = FinesVehicle & Document;

/**
 * Fines Vehicle Schema - საპატრულო ჯარიმების სისტემაში დარეგისტრირებული მანქანები
 */
@Schema({ timestamps: true })
export class FinesVehicle {
  @Prop({ required: true })
  userId: string; // რომელმა იუზერმა დაარეგისტრირა

  @Prop({ required: true })
  vehicleNumber: string; // საბარათე ნომერი (მაგ: MI-999-SS)

  @Prop({ required: true })
  techPassportNumber: string; // ტექ. პასპორტის ნომერი

  @Prop({ required: true })
  saVehicleId: number; // SA.gov.ge API-დან მოდის ID

  @Prop()
  addDate?: string; // API-დან მოდის დამატების თარიღი

  @Prop({ default: true })
  isActive: boolean; // აქტიურია თუ არა

  @Prop()
  cancelDate?: string; // გაუქმების თარიღი (თუ გაუქმებულია)

  @Prop({ default: false })
  mediaFile: boolean; // ვიდეო ჯარიმებისთვის დარეგისტრირებულია თუ არა
}

export const FinesVehicleSchema = SchemaFactory.createForClass(FinesVehicle);

// Index for faster queries
FinesVehicleSchema.index({ userId: 1 });
FinesVehicleSchema.index({ vehicleNumber: 1 });
FinesVehicleSchema.index({ saVehicleId: 1 });
FinesVehicleSchema.index({ isActive: 1 });
