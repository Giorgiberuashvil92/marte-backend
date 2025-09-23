import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
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
    return this.communityService.listPosts(userId);
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
}
