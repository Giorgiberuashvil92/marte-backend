import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { NewsFeedService } from './news-feed.service';

@Controller('news-feed')
export class NewsFeedController {
  constructor(private readonly newsFeedService: NewsFeedService) {}

  @Post()
  async create(@Body() body: any) {
    try {
      if (!body.title || !body.summary) {
        throw new BadRequestException('title და summary სავალდებულოა');
      }
      const created = await this.newsFeedService.create({
        title: body.title,
        summary: body.summary,
        category: body.category,
        image: body.image,
        body: body.body,
        publishedAt: body.publishedAt ? new Date(body.publishedAt) : undefined,
      });
      return {
        success: true,
        message: 'სტატია წარმატებით დაემატა',
        data: created,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  @Get()
  async findAll(@Query('activeOnly') activeOnly?: string) {
    const active = activeOnly !== 'false';
    const data = await this.newsFeedService.findAll(active);
    return {
      success: true,
      data,
      count: data.length,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const data = await this.newsFeedService.findOne(id);
      return { success: true, data };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new NotFoundException(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    try {
      const updates: any = {};
      if (body.title !== undefined) updates.title = body.title;
      if (body.summary !== undefined) updates.summary = body.summary;
      if (body.category !== undefined) updates.category = body.category;
      if (body.image !== undefined) updates.image = body.image;
      if (body.body !== undefined) updates.body = body.body;
      if (body.isActive !== undefined) updates.isActive = body.isActive;
      if (body.publishedAt !== undefined)
        updates.publishedAt = new Date(body.publishedAt);
      const data = await this.newsFeedService.update(id, updates);
      return {
        success: true,
        message: 'სტატია წარმატებით განახლდა',
        data,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new NotFoundException(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    try {
      await this.newsFeedService.delete(id);
      return {
        success: true,
        message: 'სტატია წარმატებით წაიშალა',
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new NotFoundException(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  @Post(':id/view')
  async incrementViews(@Param('id') id: string) {
    try {
      await this.newsFeedService.incrementViews(id);
      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new NotFoundException(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
