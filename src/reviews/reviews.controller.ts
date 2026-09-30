import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  async create(@Body() body: any) {
    const message = String(body?.message || '').trim();
    if (!message) return { success: false, error: 'message_required' };
    const created = await this.reviewsService.create({
      message,
      userId: body?.userId,
      userName: body?.userName,
      phone: body?.phone,
      source: body?.source || 'unknown',
      rating: body?.rating ? Number(body.rating) : undefined,
      category: body?.category,
    });
    return { success: true, data: created.toJSON() };
  }

  @Get()
  async list(@Query('limit') limit?: string, @Query('offset') offset?: string, @Query('source') source?: string) {
    return { success: true, ...(await this.reviewsService.list({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      source,
    })) };
  }
}
