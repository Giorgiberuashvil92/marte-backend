import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { CommunityService } from './community.service';

@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Post('posts')
  createPost(@Body() dto: any) {
    return this.communityService.createPost(dto);
  }

  @Get('posts')
  listPosts(@Query('userId') userId?: string) {
    if (userId) {
      const limit = 20;
      return this.communityService.getFollowFeed(userId, limit);
    }
    return this.communityService.listPosts();
  }

  @Get('feed')
  getFeed(
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    if (!userId) throw new BadRequestException('user_id_required');
    const lim = Math.max(1, Math.min(parseInt(limit || '20'), 50));
    return this.communityService.getFollowFeed(userId, lim, cursor);
  }

  @Get('posts/:id')
  getPost(@Param('id') id: string) {
    return this.communityService.getPost(id);
  }

  @Patch('posts/:id')
  updatePost(@Param('id') id: string, @Body() dto: any) {
    return this.communityService.updatePost(id, dto);
  }

  @Delete('posts/:id')
  deletePost(@Param('id') id: string) {
    return this.communityService.deletePost(id);
  }

  @Post('comments')
  addComment(@Body() dto: any) {
    return this.communityService.addComment(dto);
  }

  @Get('posts/:id/comments')
  listComments(@Param('id') postId: string) {
    return this.communityService.listComments(postId);
  }

  // Align to frontend expected routes
  @Post('posts/:postId/comments')
  addCommentForPost(@Param('postId') postId: string, @Body() dto: any) {
    return this.communityService.addComment({ ...dto, postId });
  }

  @Post('posts/:id/like')
  togglePostLike(@Param('id') id: string, @Body() dto: { userId: string }) {
    return this.communityService.togglePostLike(id, dto?.userId);
  }

  @Post('comments/:commentId/like')
  toggleCommentLike(
    @Param('commentId') commentId: string,
    @Body() dto: { userId: string },
  ) {
    return this.communityService.toggleCommentLike(commentId, dto?.userId);
  }

  @Get('comments/:commentId/likes')
  listCommentLikes(@Param('commentId') commentId: string) {
    return this.communityService.listCommentLikes(commentId);
  }

  @Delete('comments/:commentId')
  deleteComment(@Param('commentId') commentId: string) {
    return this.communityService.deleteComment(commentId);
  }

  @Get('posts/:id/likes')
  getPostLikes(@Param('id') postId: string) {
    return this.communityService.getPostLikes(postId);
  }

  @Get('admin/posts')
  getAdminPosts() {
    return this.communityService.getAdminPosts();
  }

  @Post('groups')
  createGroup(
    @Body()
    body: {
      ownerId?: string;
      name?: string;
      description?: string;
      coverImage?: string;
    },
  ) {
    if (!body?.ownerId || !body?.name) {
      throw new BadRequestException('owner_id_and_name_required');
    }
    return this.communityService.createGroup({
      ownerId: body.ownerId,
      name: body.name,
      description: body.description,
      coverImage: body.coverImage,
    });
  }

  @Get('groups')
  listGroups(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const lim = Math.max(1, Math.min(parseInt(limit || '20'), 50));
    const off = Math.max(0, parseInt(offset || '0'));
    return this.communityService.listGroups(lim, off);
  }

  @Get('groups/:groupId')
  getGroup(@Param('groupId') groupId: string) {
    return this.communityService.getGroupById(groupId);
  }

  @Patch('groups/:groupId')
  updateGroup(
    @Param('groupId') groupId: string,
    @Body()
    body: {
      actorId?: string;
      name?: string;
      description?: string;
      coverImage?: string;
    },
  ) {
    if (!body?.actorId) throw new BadRequestException('actor_id_required');
    return this.communityService.updateGroup(groupId, body.actorId, {
      name: body.name,
      description: body.description,
      coverImage: body.coverImage,
    });
  }

  @Delete('groups/:groupId')
  deleteGroup(
    @Param('groupId') groupId: string,
    @Query('actorId') actorId?: string,
  ) {
    if (!actorId) throw new BadRequestException('actor_id_required');
    return this.communityService.deleteGroup(groupId, actorId);
  }

  @Get('groups/:groupId/posts')
  listGroupPosts(
    @Param('groupId') groupId: string,
    @Query('limit') limit?: string,
  ) {
    const lim = Math.max(1, Math.min(parseInt(limit || '20'), 50));
    return this.communityService.listGroupPosts(groupId, lim);
  }

  @Post('groups/:groupId/join')
  joinGroup(
    @Param('groupId') groupId: string,
    @Body() body: { userId?: string },
  ) {
    if (!body?.userId) throw new BadRequestException('user_id_required');
    return this.communityService.joinGroup(groupId, body.userId);
  }

  @Post('groups/:groupId/leave')
  leaveGroup(
    @Param('groupId') groupId: string,
    @Body() body: { userId?: string },
  ) {
    if (!body?.userId) throw new BadRequestException('user_id_required');
    return this.communityService.leaveGroup(groupId, body.userId);
  }
}
