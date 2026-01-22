import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { AuthGuard } from '../middleware/auth.middleware';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('code')
  @UseGuards(AuthGuard)
  async getReferralCode(@Req() req: any) {
    const userId = req.user?.id || req.headers['x-user-id'];
    return {
      success: true,
      code: await this.referralsService.getReferralCode(userId),
    };
  }

  @Post('generate')
  @UseGuards(AuthGuard)
  async generateCode(@Req() req: any) {
    const userId = req.user?.id || req.headers['x-user-id'];
    return {
      success: true,
      code: await this.referralsService.generateReferralCode(userId),
    };
  }

  @Post('apply')
  async applyCode(
    @Body() body: { inviteeUserId: string; referralCode: string },
  ) {
    try {
      if (!body?.inviteeUserId || !body?.referralCode) {
        throw new BadRequestException(
          'inviteeUserId and referralCode are required',
        );
      }
      return await this.referralsService.applyReferralCode(
        body.inviteeUserId,
        body.referralCode,
      );
    } catch (error: any) {
      console.error('Error applying referral code:', error);
      throw error;
    }
  }

  @Get('stats')
  @UseGuards(AuthGuard)
  async getStats(@Req() req: any) {
    const userId = req.user?.id || req.headers['x-user-id'];
    return await this.referralsService.getReferralStats(userId);
  }

  @Get('leaderboard')
  @UseGuards(AuthGuard)
  async getLeaderboard(@Req() req: any) {
    const userId = req.user?.id || req.headers['x-user-id'];
    const limit = parseInt(req.query?.limit || '20', 10);
    const offset = parseInt(req.query?.offset || '0', 10);
    return await this.referralsService.getReferralLeaderboard(
      userId,
      limit,
      offset,
    );
  }
}
