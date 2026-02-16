import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RadarDocument = Radar & Document;

@Schema({ timestamps: true })
export class Radar {
  @Prop({ required: true })
  latitude: number;

  @Prop({ required: true })
  longitude: number;

  @Prop({ required: true })
  type: 'fixed' | 'mobile' | 'average_speed'; // ფიქსირებული, მობილური, საშუალო სიჩქარე

  @Prop()
  direction?: string; // მიმართულება (მაგ: "თბილისი-ბათუმი")

  @Prop()
  speedLimit?: number; // სიჩქარის ლიმიტი კმ/სთ

  @Prop({ default: 0 })
  fineCount: number; // რამდენი ჯარიმა დაწერეს ამ რადარზე

  @Prop()
  lastFineDate?: Date; // ბოლო ჯარიმის თარიღი

  @Prop()
  description?: string; // დამატებითი ინფორმაცია

  @Prop()
  address?: string; // მისამართი

  @Prop({ default: true })
  isActive: boolean; // აქტიურია თუ არა

  @Prop()
  source?: string; // წყარო (radars.ge, borbalo, user_report)

  @Prop()
  reportedBy?: string; // ვინ მოხსენია (user ID)

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const RadarSchema = SchemaFactory.createForClass(Radar);

// ინდექსი კოორდინატებისთვის სწრაფი ძიებისთვის
RadarSchema.index({ latitude: 1, longitude: 1 });
RadarSchema.index({ isActive: 1 });
