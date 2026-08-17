/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InsuranceLeadDocument = InsuranceLead & Document;

/**
 * ავტოდაზღვევის განაცხადი (პარტნიორი დაზღვევა) — მომხმარებელი ტოვებს კონტაქტს
 * და არჩეულ პროდუქტს/ლიმიტს, ადმინი უკავშირდება გასაფორმებლად.
 */
@Schema({ timestamps: true })
export class InsuranceLead {
  @Prop({ required: true })
  firstName: string;

  @Prop({ default: '' })
  lastName: string;

  @Prop({ default: '' })
  personalId: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ default: '' })
  email: string;

  @Prop()
  userId?: string;

  /** motor | mtpl | mtpl_premium */
  @Prop({ required: true, default: 'motor' })
  productType: string;

  /** არჩეული ლიმიტის key (მაგ. mtpl_10000) */
  @Prop({ default: '' })
  planKey: string;

  /** ადამიანურად წაკითხვადი ლიმიტის აღწერა (მაგ. „10 000 ₾ · თვეში 10 ₾“) */
  @Prop({ default: '' })
  planLabel: string;

  @Prop({ default: 0 })
  priceMonthly: number;

  @Prop({ default: 0 })
  priceYearly: number;

  /** მანქანის ინფო (არასავალდებულო) */
  @Prop({ default: '' })
  carInfo: string;

  /** მაგ. insurance_screen */
  @Prop({ default: 'insurance_screen' })
  source: string;

  @Prop({ default: '' })
  adminNote: string;

  @Prop({ default: false })
  called: boolean;
}

export const InsuranceLeadSchema = SchemaFactory.createForClass(InsuranceLead);

InsuranceLeadSchema.set('toJSON', {
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
