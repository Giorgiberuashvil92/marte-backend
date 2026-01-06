import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async create(@Body() body: any) {
    const message = (body?.message || '').trim();
    if (!message) {
      return { success: false, error: 'message_required' };
    }

    const payload = {
      message,
      userId: body?.userId,
      userName: body?.userName,
      phone: body?.phone,
      source: body?.source || 'unknown',
    };

    const created = await this.feedbackService.create(payload);
    return { success: true, data: created };
  }

  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedOffset = offset ? Number(offset) : undefined;
    const result = await this.feedbackService.list({
      limit: parsedLimit,
      offset: parsedOffset,
    });
    return { success: true, ...result };
  }
}
