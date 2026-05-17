import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserFollowDocument = UserFollow & Document;

@Schema({ timestamps: true })
export class UserFollow {
  @Prop({ required: true, index: true })
  followerId: string;

  @Prop({ required: true, index: true })
  followingId: string;
}

export const UserFollowSchema = SchemaFactory.createForClass(UserFollow);

UserFollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
UserFollowSchema.index({ followingId: 1, createdAt: -1 });
UserFollowSchema.index({ followerId: 1, createdAt: -1 });
