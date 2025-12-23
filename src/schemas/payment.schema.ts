import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  orderId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ required: true })
  paymentMethod: string;

  @Prop({ required: true })
  status: string;

  @Prop({ required: true })
  context: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  paymentDate: Date;

  @Prop({ required: false })
  paymentToken?: string; // BOG payment token for recurring payments

  @Prop({ required: false })
  isRecurring?: boolean; // არის თუ არა ეს რეკურინგ გადახდა

  @Prop({ required: false })
  recurringPaymentId?: string; // რეკურინგ გადახდის ID

  @Prop({
    required: false,
    type: {
      serviceId: { type: String, required: false },
      serviceName: { type: String, required: false },
      locationId: { type: String, required: false },
      locationName: { type: String, required: false },
      selectedDate: { type: String, required: false },
      selectedTime: { type: String, required: false },
      bookingType: { type: String, required: false },
      customerInfo: {
        type: {
          name: { type: String, required: false },
          phone: { type: String, required: false },
          email: { type: String, required: false },
        },
        required: false,
      },
    },
  })
  metadata?: {
    serviceId?: string;
    serviceName?: string;
    locationId?: string;
    locationName?: string;
    selectedDate?: string;
    selectedTime?: string;
    bookingType?: string;
    customerInfo?: {
      name?: string;
      phone?: string;
      email?: string;
    };
  };

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
