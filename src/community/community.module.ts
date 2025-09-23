import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CommunityPost,
  CommunityPostSchema,
} from '../schemas/community-post.schema';
import { Comment, CommentSchema } from '../schemas/comment.schema';
import { PostLike, PostLikeSchema } from '../schemas/post-like.schema';
import { CommentLike, CommentLikeSchema } from '../schemas/comment-like.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CommunityPost.name, schema: CommunityPostSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: PostLike.name, schema: PostLikeSchema },
      { name: CommentLike.name, schema: CommentLikeSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
