import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** EV რუკა — «პაკეტის არჩევა» / პარტნიორის აპის ღილაკი */
@Schema({ _id: false })
export class EvPackageCtaEmbed {
  @Prop({ default: 'პაკეტის არჩევა' })
  label?: string;

  /** internal = Marte აპის გვერდი; external = deeplink / სტორი / ბრაუზერი */
  @Prop({ default: 'internal', enum: ['internal', 'external'] })
  linkType?: string;

  @Prop({ default: '/premium-offers?source=ev_charging_map' })
  url?: string;

  @Prop()
  iosUrl?: string;

  @Prop()
  androidUrl?: string;

  /** external ვერ გაიხსნა → შიდა მარშრუტი */
  @Prop()
  fallbackUrl?: string;
}

export const EvPackageCtaEmbedSchema =
  SchemaFactory.createForClass(EvPackageCtaEmbed);
