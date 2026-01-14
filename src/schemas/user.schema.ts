import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true, unique: true })
  phone: string;

  @Prop({ unique: true, sparse: true })
  firebaseUid?: string;

  @Prop()
  email?: string;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop()
  personalId?: string;

  @Prop()
  profileImage?: string;

  @Prop({ required: true, default: false })
  isVerified: boolean;

  @Prop()
  verificationCode?: string;

  @Prop()
  verificationExpires?: number;

  @Prop({ required: true, default: true })
  isActive: boolean;

  @Prop()
  lastLoginAt?: number;

  @Prop({ type: Object })
  preferences?: {
    language: string;
    notifications: boolean;
    theme: string;
  };

  @Prop({ required: true })
  createdAt: number;

  @Prop({ required: true })
  updatedAt: number;

  @Prop({
    type: String,
    enum: ['customer', 'owner', 'manager', 'employee', 'user'],
    default: 'customer',
  })
  role: string;

  @Prop({ type: [String], default: [] })
  ownedCarwashes: string[];

  @Prop({ type: [String], default: [] })
  ownedStores: string[];

  @Prop({ type: [String], default: [] })
  ownedDismantlers: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes for better performance
// Avoid duplicate definition warnings; rely on @Prop uniques for phone/firebaseUid
UserSchema.index({ email: 1 }, { sparse: true });
UserSchema.index({ isVerified: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ createdAt: -1 });
