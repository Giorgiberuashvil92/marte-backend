import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { StoriesService } from '../stories/stories.service';

@Controller('stories')
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  @Get()
  async list(
    @Query('category') category?: string,
    @Query('highlight') highlight?: string,
    @Query('userId') userId?: string,
  ) {
    const data = await this.stories.list({
      category,
      highlight:
        highlight === 'true' ? true : highlight === 'false' ? false : undefined,
      userId,
    });
    return { success: true, data };
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const data = await this.stories.one(id);
    return { success: true, data };
  }

  @Post()
  async create(
    @Body()
    body: {
      authorId?: string;
      authorName?: string;
      authorAvatar?: string;
      category?: string;
      highlight?: boolean;
      items?: unknown[];
    },
  ) {
    if (!body?.authorId || !body?.authorName)
      throw new BadRequestException('author_required');
    const data = await this.stories.create(body as any);
    return { success: true, data };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      authorId: string;
      authorName: string;
      authorAvatar?: string;
      category?: string;
      highlight?: boolean;
      items?: unknown[];
    }>,
  ) {
    const data = await this.stories.update(id, body as any);
    return { success: true, data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.stories.remove(id);
    return { success: true };
  }

  @Post(':id/seen')
  async seen(@Param('id') id: string, @Body() body: { userId?: string }) {
    const res = await this.stories.markSeen(id, body?.userId || '');
    return { success: true, data: res };
  }

  @Get(':id/views')
  async views(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const res = await this.stories.listViews(
      id,
      parseInt(limit || '50'),
      parseInt(offset || '0'),
    );
    return { success: true, ...res };
  }
}
