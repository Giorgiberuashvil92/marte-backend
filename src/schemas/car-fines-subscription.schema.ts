import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CarFinesSubscriptionDocument = CarFinesSubscription & Document;

/**
 * CarFinesSubscription - კონკრეტულ მანქანაზე მიბმული ჯარიმების მონიტორინგის გამოწერა
 * პრემიუმში 1 მანქანა ჩათვლილია, ყოველი დამატებითი მანქანა = 1₾/თვე
 */
@Schema({ timestamps: true })
export class CarFinesSubscription {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  carId: string; // გარაჟიდან მანქანის ID

  @Prop({ required: true })
  vehicleNumber: string; // საბარათე ნომერი (მაგ: MI-999-SS)

  @Prop({ required: true })
  techPassportNumber: string;

  @Prop({ default: 1 })
  price: number; // ფასი ლარებში (1₾/თვე)

  @Prop({
    required: true,
    enum: ['active', 'expired', 'cancelled', 'pending'],
    default: 'pending',
  })
  status: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop()
  endDate?: Date;

  @Prop()
  nextBillingDate?: Date;

  @Prop({ default: false })
  isPaid: boolean; // გადახდილია თუ არა მიმდინარე პერიოდისთვის

  @Prop()
  lastPaymentDate?: Date;

  @Prop()
  paymentTransactionId?: string;

  @Prop()
  orderId?: string;

  @Prop({ default: 0 })
  totalPaid: number;

  @Prop({ default: 0 })
  billingCycles: number;

  @Prop({ default: false })
  isFirstCar: boolean; // პრემიუმში ჩათვლილი პირველი მანქანა (უფასო)

  @Prop()
  bogCardToken?: string; // BOG-ის order_id, რეკურინგ გადახდებისთვის (save_card)
}

export const CarFinesSubscriptionSchema =
  SchemaFactory.createForClass(CarFinesSubscription);

// Indexes
CarFinesSubscriptionSchema.index({ userId: 1 });
CarFinesSubscriptionSchema.index({ carId: 1 });
CarFinesSubscriptionSchema.index({ vehicleNumber: 1 });
CarFinesSubscriptionSchema.index({ userId: 1, status: 1 });
CarFinesSubscriptionSchema.index({ userId: 1, carId: 1 }, { unique: true });
