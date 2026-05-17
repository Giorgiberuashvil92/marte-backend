import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class EvChargerEmbedded {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  label: string;

  @Prop({ required: true, default: 'Type2' })
  connectorType: string;

  @Prop({ required: true, default: 22 })
  maxPowerKw: number;

  @Prop({ default: 'unknown' })
  status?: string;
}

const EvChargerEmbeddedSchema = SchemaFactory.createForClass(EvChargerEmbedded);

@Schema({ timestamps: true })
export class EvStation {
  @Prop({ sparse: true, unique: true, trim: true })
  stationId?: string;

  @Prop({ required: true, trim: true, index: true })
  partnerId: string;

  @Prop({ required: true, trim: true })
  partnerName: string;

  @Prop()
  partnerLogoUrl?: string;

  @Prop({ required: true, trim: true })
  siteName: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ required: true })
  latitude: number;

  @Prop({ required: true })
  longitude: number;

  @Prop()
  phone?: string;

  @Prop({ type: [EvChargerEmbeddedSchema], default: [] })
  chargers: EvChargerEmbedded[];

  @Prop()
  perkHint?: string;

  @Prop()
  heroImageUrl?: string;

  @Prop({ type: [String], default: [] })
  galleryImageUrls?: string[];

  @Prop()
  openingHours?: string;

  @Prop({ type: [String], default: [] })
  amenities?: string[];

  @Prop()
  rating?: number;

  @Prop({ default: 0 })
  reviewsCount?: number;

  @Prop()
  priceLabel?: string;

  @Prop()
  chargeSpeedHint?: string;

  @Prop()
  aboutText?: string;

  @Prop({ default: true })
  isActive?: boolean;

  @Prop({ default: 0 })
  sortOrder?: number;
}

export type EvStationDocument = HydratedDocument<EvStation>;
export const EvStationSchema = SchemaFactory.createForClass(EvStation);
EvStationSchema.index({ isActive: 1, latitude: 1, longitude: 1 });
EvStationSchema.index({ partnerId: 1 });
