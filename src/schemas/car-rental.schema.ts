import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CarRentalDocument = CarRental & Document;

/**
 * Car Rental Schema - მანქანების გაქირავების სქემა
 */
@Schema({ timestamps: true })
export class CarRental {
  @Prop({ required: true })
  brand: string; // მაგ: "Toyota", "Mercedes", "BMW"

  @Prop({ required: true })
  model: string; // მაგ: "Camry", "E-Class", "X5"

  @Prop({ required: true })
  year: number; // წელი: 2023, 2022, etc.

  @Prop({ required: true })
  category: string; // "ეკონომი", "კომფორტი", "ლუქსი", "SUV", "მინივენი"

  @Prop({ required: true })
  pricePerDay: number; // ღირებულება დღეში (GEL)

  @Prop()
  pricePerWeek?: number; // ღირებულება კვირაში (GEL)

  @Prop()
  pricePerMonth?: number; // ღირებულება თვეში (GEL)

  @Prop({ type: [String], default: [] })
  images: string[]; // მანქანის ფოტოები

  @Prop({ required: true })
  description: string; // აღწერა

  @Prop({ type: [String], default: [] })
  features: string[]; // მაგ: ["GPS", "Bluetooth", "კონდიციონერი", "ავტომატიკა"]

  @Prop({ required: true })
  transmission: string; // "მექანიკა" ან "ავტომატიკა"

  @Prop({ required: true })
  fuelType: string; // "ბენზინი", "დიზელი", "ჰიბრიდი", "ელექტრო"

  @Prop({ required: true })
  seats: number; // ადგილების რაოდენობა

  @Prop({ required: true })
  location: string; // მდებარეობა: "თბილისი", "ბათუმი", etc.

  @Prop()
  address?: string; // ზუსტი მისამართი

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  @Prop({ required: true })
  phone: string; // საკონტაქტო ტელეფონი

  @Prop()
  email?: string;

  @Prop()
  ownerId?: string; // მფლობელის ID

  @Prop()
  ownerName?: string; // მფლობელის სახელი

  @Prop({ default: true })
  available: boolean; // ხელმისაწვდომია თუ არა

  @Prop()
  licensePlate?: string; // სახელმწიფო ნომერი (არასავალდებულო)

  @Prop({ type: Object })
  insurance?: {
    hasInsurance: boolean;
    insuranceType?: string;
    expiryDate?: Date;
  };

  @Prop({ default: 0 })
  rating: number; // 0-5

  @Prop({ default: 0 })
  reviews: number; // მიმოხილვების რაოდენობა

  @Prop({ default: 0 })
  totalBookings: number; // სულ დაჯავშნები

  @Prop({ type: [String], default: [] })
  unavailableDates: string[]; // თარიღები როდესაც მანქანა დაკავებულია (ISO strings)

  @Prop({ default: 100 }) // Default deposit 100 GEL
  deposit: number; // დეპოზიტი (GEL)

  @Prop()
  minRentalDays?: number; // მინიმალური გაქირავების დღეები

  @Prop()
  maxRentalDays?: number; // მაქსიმალური გაქირავების დღეები

  @Prop({ type: Object })
  extras?: {
    childSeat?: number; // ბავშვის სავარძლის ფასი
    additionalDriver?: number; // დამატებითი მძღოლი
    navigation?: number; // GPS ნავიგაცია
    insurance?: number; // დამატებითი დაზღვევა
  };

  @Prop({ default: true })
  isActive: boolean; // აქტიურია თუ არა განცხადება

  @Prop({ default: 0 })
  views: number; // ნახვების რაოდენობა

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const CarRentalSchema = SchemaFactory.createForClass(CarRental);

// Indexes for better query performance
CarRentalSchema.index({ location: 1, available: 1 });
CarRentalSchema.index({ category: 1, pricePerDay: 1 });
CarRentalSchema.index({ brand: 1, model: 1 });
CarRentalSchema.index({ rating: -1 });
CarRentalSchema.index({ createdAt: -1 });
