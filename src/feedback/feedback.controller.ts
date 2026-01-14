import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async create(@Body() body: any) {
    console.log('📝 [FEEDBACK] POST request received:', body);
    const message = (body?.message || '').trim();
    if (!message) {
      console.log('❌ [FEEDBACK] Message is required');
      return { success: false, error: 'message_required' };
    }

    const payload = {
      message,
      userId: body?.userId,
      userName: body?.userName,
      phone: body?.phone,
      source: body?.source || 'unknown',
    };

    console.log('📝 [FEEDBACK] Payload:', payload);
    const created = await this.feedbackService.create(payload);
    console.log('✅ [FEEDBACK] Created:', created);

    // Convert mongoose document to plain object
    const result = created.toJSON ? created.toJSON() : created;
    return { success: true, data: result };
  }

  @Get()
  async list(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedOffset = offset ? Number(offset) : undefined;
    const result = await this.feedbackService.list({
      limit: parsedLimit,
      offset: parsedOffset,
    });
    return { success: true, ...result };
  }
}
