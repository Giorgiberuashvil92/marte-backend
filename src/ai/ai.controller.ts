import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { AIRecommendationsService } from './ai-recommendations.service';
import type { PartsRequest } from './ai-recommendations.service';

@Controller('ai')
export class AIController {
  constructor(
    private readonly aiRecommendationsService: AIRecommendationsService,
  ) {}

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
}
