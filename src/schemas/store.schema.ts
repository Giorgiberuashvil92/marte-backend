import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StoreDocument = Store & Document;

@Schema({ timestamps: true })
export class Store {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({
    type: String,
    enum: [
      'მაღაზიები',
      'ნაწილები',
      'დაშლილები',
      'ზეთები',
      'ხელოსნები',
      'ავტოსერვისები',
      'ევაკუატორი',
      'დითეილინგი',
      'აქსესუარები',
      'ავტომობილის ინტერიერი',
      'ავტონაწილები', // backward compatibility
      'სამართ-დასახურებელი', // backward compatibility
      'რემონტი', // backward compatibility
      'სხვა', // backward compatibility
    ],
    required: true,
  })
  type: string;

  @Prop({ type: [String] })
  images?: string[];

  // შიდა/ინტერნალური გამოსახულება ( напр. admin panel cover )
  @Prop()
  internalImage?: string;

  @Prop({ required: true })
  location: string;

  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  email?: string;

  @Prop()
  website?: string;

  @Prop()
  workingHours?: string;

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  @Prop({ type: [String] })
  services?: string[];

  @Prop({ type: [String] })
  specializations?: string[];

  @Prop()
  ownerName?: string;

  @Prop()
  managerName?: string;

  @Prop()
  alternativePhone?: string;

  @Prop()
  facebook?: string;

  @Prop()
  instagram?: string;

  @Prop()
  youtube?: string;

  @Prop()
  yearEstablished?: number;

  @Prop()
  employeeCount?: number;

  @Prop()
  license?: string;

  @Prop({ required: true })
  ownerId: string;

  @Prop({
    type: String,
    enum: ['pending', 'active', 'inactive'],
    default: 'pending',
  })
  status?: string;

  // Payment information
  @Prop()
  lastPaymentDate?: Date;

  @Prop()
  nextPaymentDate?: Date;

  @Prop({ default: 0 })
  totalPaid?: number;

  @Prop()
  paymentStatus?: string; // 'paid', 'pending', 'overdue'

  @Prop()
  paymentAmount?: number; // Monthly payment amount

  @Prop()
  paymentPeriod?: string; // 'monthly', 'yearly'

  @Prop({ default: false })
  isFeatured?: boolean; // VIP მაღაზია

  @Prop({ type: Date })
  expiryDate?: Date; // განცხადების ვადის გასვლის თარიღი (1 თვე შექმნის თარიღიდან)
}

export const StoreSchema = SchemaFactory.createForClass(Store);
