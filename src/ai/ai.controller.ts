import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AIRecommendationsService } from './ai-recommendations.service';
import type { PartsRequest } from './ai-recommendations.service';
import { AIChatService, type AIChatRequest } from './ai-chat.service';

@Controller('ai')
export class AIController {
  constructor(
    private readonly aiRecommendationsService: AIRecommendationsService,
    private readonly aiChatService: AIChatService,
  ) {}

  @Post('chat')
  async chat(@Body() request: AIChatRequest) {
    if (!request?.message?.trim()) {
      throw new BadRequestException({
        success: false,
        message: 'message აუცილებელია',
      });
    }

    const data = await this.aiChatService.reply({
      ...request,
      message: request.message.trim(),
    });

    return {
      success: true,
      data,
    };
  }

  @Post('chat/stream')
  async chatStream(@Body() request: AIChatRequest, @Res() res: Response) {
    if (!request?.message?.trim()) {
      throw new BadRequestException({
        success: false,
        message: 'message აუცილებელია',
      });
    }

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      for await (const event of this.aiChatService.streamReply({
        ...request,
        message: request.message.trim(),
      })) {
        res.write(`${JSON.stringify(event)}\n`);
      }
    } catch (error) {
      res.write(
        `${JSON.stringify({
          type: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'AI stream ვერ შესრულდა',
        })}\n`,
      );
    } finally {
      res.end();
    }
  }

  @Post('recommendations/parts')
  async getPartsRecommendations(@Body() request: PartsRequest) {
    try {
      console.log('🤖 AI Parts Recommendations Request:', request);

      const recommendations =
        await this.aiRecommendationsService.recommendForPartsRequest(request);
      const explanation = this.aiRecommendationsService.generateAIExplanation(
        recommendations,
        request,
      );

      return {
        success: true,
        message: 'AI რეკომენდაციები წარმატებით გენერირდა',
        data: {
          request,
          recommendations,
          explanation,
          totalFound: recommendations.length,
          breakdown: {
            parts: recommendations.filter((r) => r.type === 'part').length,
            stores: recommendations.filter((r) => r.type === 'store').length,
            dismantlers: recommendations.filter((r) => r.type === 'dismantler')
              .length,
          },
        },
      };
    } catch (error) {
      console.error('❌ AI Recommendations Error:', error);
      throw new BadRequestException({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'AI რეკომენდაციების გენერირება ვერ მოხერხდა',
      });
    }
  }

  @Get('recommendations/parts')
  async getPartsRecommendationsGet(
    @Query('make') make: string,
    @Query('model') model: string,
    @Query('partName') partName: string,
    @Query('year') year?: string,
    @Query('submodel') submodel?: string,
    @Query('partDetails') partDetails?: string,
    @Query('location') location?: string,
    @Query('maxDistance') maxDistance?: string,
  ) {
    if (!make || !model || !partName) {
      throw new BadRequestException({
        success: false,
        message: 'make, model და partName პარამეტრები აუცილებელია',
      });
    }

    const request: PartsRequest = {
      vehicle: {
        make,
        model,
        year,
        submodel,
      },
      partName,
      partDetails,
      location,
      maxDistance: maxDistance ? parseInt(maxDistance) : undefined,
    };

    return this.getPartsRecommendations(request);
  }

  @Get('stats')
  getAIStats() {
    // This could return statistics about AI recommendations
    return {
      success: true,
      message: 'AI სტატისტიკა',
      data: {
        totalRecommendations: 0, // Could be tracked in database
        averageConfidence: 0.85,
        mostRequestedParts: [],
        mostActiveRegions: [],
      },
    };
  }

  @Get('seller-status')
  async getSellerStatus(
    @Query('userId') userId: string,
    @Query('phone') phone?: string,
    @Query('make') make?: string,
    @Query('model') model?: string,
    @Query('year') year?: string,
    @Query('debug') debug?: string,
  ) {
    if (!userId) {
      throw new BadRequestException({
        success: false,
        message: 'userId აუცილებელია',
      });
    }
    const data = await this.aiRecommendationsService.getSellerStatus({
      userId,
      phone,
      make,
      model,
      year,
      debug: debug === 'true',
    });
    return { success: true, data };
  }
}
