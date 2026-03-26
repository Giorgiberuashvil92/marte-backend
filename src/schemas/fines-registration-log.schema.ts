import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FinesRegistrationLogDocument = FinesRegistrationLog & Document;

/**
 * ყოველი SA-ში წარმატებული რეგისტრაციის ლოგი — ვინ დაარეგისტრირა (გარაჟში არ უნდა ჰქონდეს მანქანა)
 */
@Schema({ timestamps: true })
export class FinesRegistrationLog {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  vehicleNumber: string;

  @Prop({ required: true })
  techPassportNumber: string;

  @Prop({ required: true })
  saVehicleId: number;

  @Prop()
  addDate?: string;
}

export const FinesRegistrationLogSchema =
  SchemaFactory.createForClass(FinesRegistrationLog);

FinesRegistrationLogSchema.index({ saVehicleId: 1 });
FinesRegistrationLogSchema.index({ userId: 1 });
