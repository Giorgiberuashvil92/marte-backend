import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SpecialOfferDocument = SpecialOffer & Document;

@Schema({ timestamps: true })
export class SpecialOffer {
  @Prop({ required: true, index: true })
  storeId: string;

  @Prop({ required: true })
  discount: string; // e.g., "20%", "15%"

  @Prop({ required: true })
  oldPrice: string; // e.g., "150₾"

  @Prop({ required: true })
  newPrice: string; // e.g., "120₾"

  @Prop()
  title?: string; // Optional custom title

  @Prop()
  description?: string; // Optional description

  @Prop()
  image?: string; // Optional custom image URL

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop()
  startDate?: Date; // Optional start date

  @Prop()
  endDate?: Date; // Optional end date

  @Prop({ default: 0, index: true })
  priority: number; // Higher priority shows first

  @Prop()
  createdBy?: string; // Admin user ID who created it
}

export const SpecialOfferSchema = SchemaFactory.createForClass(SpecialOffer);

// Indexes
SpecialOfferSchema.index({ storeId: 1, isActive: 1 });
SpecialOfferSchema.index({ isActive: 1, priority: -1 });
SpecialOfferSchema.index({ startDate: 1, endDate: 1 });

SpecialOfferSchema.set('toJSON', {
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

