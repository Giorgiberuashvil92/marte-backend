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

  @Get('analysis')
  async getAllReferralsAnalysis() {
    return await this.referralsService.getAllReferralsAnalysis();
  }

  /**
   * Get all users who used a specific referral code
   * Admin Panel endpoint - returns list of users who entered the referral code
   *
   * @param code - The referral code to check
   * @returns Object with inviter info and list of users who used the code
   *
   * Example response:
   * {
   *   inviterId: "usr_123",
   *   inviterName: "John Doe",
   *   users: [
   *     {
   *       userId: "usr_456",
   *       name: "Jane Smith",
   *       appliedAt: 1234567890,
   *       subscriptionEnabled: true,
   *       rewardsGranted: true,
   *       firstBookingAt: 1234567890
   *     }
   *   ]
   * }
   */
  @Get('code/:code/users')
  async getReferralCodeUsers(@Param('code') code: string) {
    return await this.referralsService.getReferralCodeUsers(code);
  }

  /**
   * Get all referrals for a specific user (by userId)
   * Admin Panel endpoint - returns list of all users who used this user's referral code
   *
   * @param userId - The user ID to check
   * @returns Object with user info, referral code, and list of all referrals
   *
   * Example response:
   * {
   *   inviterId: "usr_123",
   *   inviterName: "John Doe",
   *   referralCode: "ABC123",
   *   users: [
   *     {
   *       userId: "usr_456",
   *       name: "Jane Smith",
   *       appliedAt: 1234567890,
   *       subscriptionEnabled: true,
   *       rewardsGranted: true,
   *       firstBookingAt: 1234567890
   *     }
   *   ]
   * }
   */
  @Get('user/:userId/referrals')
  async getReferralsByUserId(@Param('userId') userId: string) {
    return await this.referralsService.getReferralsByUserId(userId);
  }

  /**
   * Get detailed referral usage history/logs for a specific user
   * Admin Panel endpoint - returns detailed history with timestamps and formatted dates
   *
   * @param userId - The user ID to check
   * @returns Object with detailed referral history including timestamps
   *
   * Example response:
   * {
   *   inviterId: "usr_123",
   *   inviterName: "John Doe",
   *   referralCode: "ABC123",
   *   totalReferrals: 2,
   *   history: [
   *     {
   *       referralId: "...",
   *       inviteeId: "usr_456",
   *       inviteeName: "Jane Smith",
   *       appliedAt: 1234567890,
   *       appliedAtFormatted: "2024 წლის 1 იანვარი, 12:00",
   *       subscriptionEnabled: true,
   *       rewardsGranted: true,
   *       firstBookingAt: 1234567890,
   *       firstBookingAtFormatted: "2024 წლის 2 იანვარი, 14:30",
   *       createdAt: "2024-01-01T12:00:00.000Z",
   *       updatedAt: "2024-01-02T14:30:00.000Z",
   *       daysSinceApplied: 5
   *     }
   *   ]
   * }
   */
  @Get('user/:userId/history')
  async getReferralUsageHistory(@Param('userId') userId: string) {
    return await this.referralsService.getReferralUsageHistory(userId);
  }

  /**
   * Get complete referral usage history - all referrals ever used
   * Admin Panel endpoint - returns detailed history of all referral code usages
   *
   * @returns Object with summary and complete history of all referrals
   *
   * Example response:
   * {
   *   summary: {
   *     totalReferrals: 10,
   *     totalInviters: 5,
   *     totalInvitees: 10,
   *     subscriptionsEnabled: 8,
   *     rewardsGranted: 6,
   *     pendingRewards: 2
   *   },
   *   history: [
   *     {
   *       referralId: "...",
   *       inviterId: "usr_123",
   *       inviterName: "John Doe",
   *       inviterReferralCode: "ABC123",
   *       inviteeId: "usr_456",
   *       inviteeName: "Jane Smith",
   *       appliedAt: 1234567890,
   *       appliedAtFormatted: "2024 წლის 1 იანვარი, 12:00",
   *       subscriptionEnabled: true,
   *       rewardsGranted: true,
   *       firstBookingAt: 1234567890,
   *       firstBookingAtFormatted: "2024 წლის 2 იანვარი, 14:30",
   *       createdAt: "2024-01-01T12:00:00.000Z",
   *       updatedAt: "2024-01-02T14:30:00.000Z",
   *       daysSinceApplied: 5
   *     }
   *   ]
   * }
   */
  @Get('history/all')
  async getAllReferralsHistory() {
    return await this.referralsService.getAllReferralsHistory();
  }
}
