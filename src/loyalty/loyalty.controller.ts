import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';

@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get('summary')
  async summary(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId_required');
    const data = await this.loyalty.getSummary(userId);
    return { success: true, data };
  }

  @Get('transactions')
  async transactions(
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId) throw new BadRequestException('userId_required');
    const data = await this.loyalty.getTransactions(
      userId,
      limit ? parseInt(limit) : 20,
    );
    return { success: true, data };
  }

  @Get('rewards')
  async rewards(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId_required');
    const data = await this.loyalty.getRewards(userId);
    return { success: true, data };
  }

  @Post('redeem')
  async redeem(@Body() body: { userId?: string; rewardId?: string }) {
    if (!body?.userId || !body?.rewardId)
      throw new BadRequestException('userId_and_rewardId_required');
    const data = await this.loyalty.redeem(body.userId, body.rewardId);
    return { success: true, data };
  }

  @Get('leaderboard')
  async leaderboard(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId_required');
    const data = await this.loyalty.getLeaderboard(userId);
    return { success: true, data };
  }

  @Get('friends')
  async friends(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId_required');
    const data = await this.loyalty.getFriends(userId);
    return { success: true, data };
  }

  @Get('achievements')
  async achievements(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId_required');
    const data = await this.loyalty.getAchievements(userId);
    return { success: true, data };
  }

  @Get('missions')
  async missions(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId_required');
    const data = await this.loyalty.getMissions(userId);
    return { success: true, data };
  }

  @Post('missions/claim')
  async claimMission(@Body() body: { userId?: string; missionId?: string }) {
    if (!body?.userId || !body?.missionId)
      throw new BadRequestException('userId_and_missionId_required');
    const data = await this.loyalty.claimMission(body.userId, body.missionId);
    return { success: true, data };
  }

  // Referral endpoints
  @Get('referral/code')
  async referralCode(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId_required');
    const data = await this.loyalty.getReferralCode(userId);
    return { success: true, data };
  }

  @Post('referral/apply')
  async referralApply(@Body() body: { inviteeId?: string; code?: string }) {
    if (!body?.inviteeId || !body?.code)
      throw new BadRequestException('inviteeId_and_code_required');
    const data = await this.loyalty.applyReferral(body.inviteeId, body.code);
    return { success: true, data };
  }

  @Post('referral/subscription-enabled')
  async referralSubEnabled(@Body() body: { userId?: string }) {
    if (!body?.userId) throw new BadRequestException('userId_required');
    const data = await this.loyalty.markSubscriptionEnabled(body.userId);
    return { success: true, data };
  }

  @Post('referral/first-booking')
  async referralFirstBooking(@Body() body: { userId?: string }) {
    if (!body?.userId) throw new BadRequestException('userId_required');
    const data = await this.loyalty.handleFirstBookingRewards(body.userId);
    return { success: true, data };
  }
}
