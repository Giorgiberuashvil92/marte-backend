import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CommunityGroupDocument = CommunityGroup & Document;

@Schema({ timestamps: true })
export class CommunityGroup {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '', trim: true })
  description: string;

  /** ჯგუფის საფარო სურათის URL (მაგ. Cloudinary) */
  @Prop({ default: '', trim: true })
  coverImage?: string;

  /** მანქანის მარკები (შეთავაზებისთვის), მაგ. ["bmw","toyota"] */
  @Prop({ type: [String], default: [] })
  carMakes?: string[];

  /** true = ყველა ბრენდისთვის (PORTAL, MARTE) */
  @Prop({ default: false })
  isUniversal?: boolean;

  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ type: [String], default: [] })
  memberIds: string[];

  @Prop({ default: 1 })
  membersCount: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const CommunityGroupSchema =
  SchemaFactory.createForClass(CommunityGroup);

CommunityGroupSchema.index({ ownerId: 1, createdAt: -1 });
