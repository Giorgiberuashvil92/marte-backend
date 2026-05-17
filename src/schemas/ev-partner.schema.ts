import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  EvPackageCtaEmbed,
  EvPackageCtaEmbedSchema,
} from './ev-package-cta.schema';

@Schema({ timestamps: true })
export class EvPartner {
  /** სტაბილური slug — მობილურში partnerId */
  @Prop({ required: true, unique: true, trim: true })
  partnerId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  logoUrl?: string;

  @Prop()
  description?: string;

  @Prop({ default: true })
  isActive?: boolean;

  @Prop({ default: 0 })
  sortOrder?: number;

  /** პარტნიორის აპის deeplink — ცარიელი = გლობალური პარამეტრი */
  @Prop({ type: EvPackageCtaEmbedSchema })
  packageCta?: EvPackageCtaEmbed;
}

export type EvPartnerDocument = HydratedDocument<EvPartner>;
export const EvPartnerSchema = SchemaFactory.createForClass(EvPartner);
EvPartnerSchema.index({ isActive: 1, sortOrder: 1 });
