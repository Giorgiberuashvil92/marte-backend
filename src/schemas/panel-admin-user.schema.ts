import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PanelAdminUserDocument = HydratedDocument<PanelAdminUser>;

@Schema({ collection: 'panel_admin_users', timestamps: true })
export class PanelAdminUser {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  username: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ trim: true })
  displayName?: string;

  @Prop({ default: true })
  active: boolean;
}

export const PanelAdminUserSchema = SchemaFactory.createForClass(PanelAdminUser);
