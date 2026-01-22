import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('track')
  async trackEvent(
    @Body()
    body: {
      eventType: string;
      eventName: string;
      userId?: string;
      screen?: string;
      params?: Record<string, any>;
    },
  ) {
    await this.analyticsService.trackEvent(
      body.eventType,
      body.eventName,
      body.userId,
      body.screen,
      body.params,
    );
    return { success: true };
  }

  @Get('screen-views')
  async getScreenViews(@Query('period') period: 'today' | 'week' | 'month' = 'week') {
    return this.analyticsService.getScreenViews(period);
  }

  @Get('button-clicks')
  async getButtonClicks(@Query('period') period: 'today' | 'week' | 'month' = 'week') {
    return this.analyticsService.getButtonClicks(period);
  }

  @Get('user-engagement')
  async getUserEngagement(@Query('period') period: 'today' | 'week' | 'month' = 'week') {
    return this.analyticsService.getUserEngagement(period);
  }

  @Get('navigation-flows')
  async getNavigationFlows(@Query('period') period: 'today' | 'week' | 'month' = 'week') {
    return this.analyticsService.getNavigationFlows(period);
  }

  @Get('popular-features')
  async getPopularFeatures(@Query('period') period: 'today' | 'week' | 'month' = 'week') {
    return this.analyticsService.getPopularFeatures(period);
  }

  @Get('dashboard')
  async getDashboard(@Query('period') period: 'today' | 'week' | 'month' = 'week') {
    const [screenViews, buttonClicks, userEngagement, navigationFlows, popularFeatures] =
      await Promise.all([
        this.analyticsService.getScreenViews(period),
        this.analyticsService.getButtonClicks(period),
        this.analyticsService.getUserEngagement(period),
        this.analyticsService.getNavigationFlows(period),
        this.analyticsService.getPopularFeatures(period),
      ]);

    return {
      screenViews,
      buttonClicks,
      userEngagement,
      navigationFlows,
      popularFeatures,
    };
  }

  @Get('user-events')
  async getUserEvents(
    @Query('userId') userId: string,
    @Query('period') period: 'today' | 'week' | 'month' = 'week',
    @Query('limit') limit: string = '100',
  ) {
    if (!userId) {
      return { error: 'userId is required' };
    }
    return await this.analyticsService.getUserEvents(
      userId,
      period,
      parseInt(limit, 10),
    );
  }

  @Get('all-users-events')
  async getAllUsersEvents(
    @Query('period') period: 'today' | 'week' | 'month' = 'week',
    @Query('limit') limit: string = '500',
  ) {
    return await this.analyticsService.getAllUsersEvents(
      period,
      parseInt(limit, 10),
    );
  }
}
