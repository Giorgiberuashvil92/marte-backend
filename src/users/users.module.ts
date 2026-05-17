import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserSchema } from '../schemas/user.schema';
import { Request, RequestSchema } from '../schemas/request.schema';
import {
  LoginHistory,
  LoginHistorySchema,
} from '../schemas/login-history.schema';
import { UserFollow, UserFollowSchema } from '../schemas/user-follow.schema';
import {
  CommunityPost,
  CommunityPostSchema,
} from '../schemas/community-post.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Request.name, schema: RequestSchema },
      { name: LoginHistory.name, schema: LoginHistorySchema },
      { name: UserFollow.name, schema: UserFollowSchema },
      { name: CommunityPost.name, schema: CommunityPostSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
