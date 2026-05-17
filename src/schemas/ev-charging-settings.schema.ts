import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  EvPackageCtaEmbed,
  EvPackageCtaEmbedSchema,
} from './ev-package-cta.schema';

@Schema({ timestamps: true })
export class EvChargingSettings {
  @Prop({ required: true, unique: true, default: 'default' })
  key: string;

  @Prop({ default: 'EV პარტნიორები' })
  pageTitle: string;

  @Prop({ default: 'Marte ქსელი' })
  networkLabel: string;

  @Prop()
  defaultAboutText?: string;

  @Prop()
  reviewsPlaceholder?: string;

  @Prop({ type: EvPackageCtaEmbedSchema })
  packageCta?: EvPackageCtaEmbed;
}

export type EvChargingSettingsDocument = HydratedDocument<EvChargingSettings>;
export const EvChargingSettingsSchema =
  SchemaFactory.createForClass(EvChargingSettings);
