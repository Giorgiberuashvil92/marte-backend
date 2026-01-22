import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';
import { Referral } from '../schemas/referral.schema';
import { Loyalty } from '../schemas/loyalty.schema';
import { LoyaltyTransaction } from '../schemas/loyalty-transaction.schema';

@Injectable()
export class ReferralsService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Referral.name) private readonly referralModel: Model<Referral>,
    @InjectModel(Loyalty.name) private readonly loyaltyModel: Model<Loyalty>,
    @InjectModel(LoyaltyTransaction.name)
    private readonly txModel: Model<LoyaltyTransaction>,
  ) {}

  /**
   * Generate a unique referral code for a user
   */
  async generateReferralCode(userId: string): Promise<string> {
    const user = await this.userModel.findOne({ id: userId }).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If user already has a referral code, return it
    if (user.referralCode) {
      return user.referralCode;
    }

    // Generate a unique code (6-8 characters, alphanumeric uppercase)
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      // Generate code: first 3 chars from userId + random 4-5 chars
      const userIdPart = userId
        .slice(-3)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, 'A');
      const randomPart = Math.random()
        .toString(36)
        .substring(2, 7)
        .toUpperCase();
      code = `${userIdPart}${randomPart}`.slice(0, 8);

      // Check if code is unique
      const existing = await this.userModel
        .findOne({ referralCode: code })
        .exec();
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    // Fallback: use timestamp-based code if not unique
    if (!isUnique) {
      code = `REF${Date.now().toString(36).toUpperCase().slice(-5)}`;
    }

    // At this point, code is always defined
    // Save code to user
    user.referralCode = code!;
    await user.save();

    return code!;
  }

  /**
   * Get referral code for a user
   */
  async getReferralCode(userId: string): Promise<string | null> {
    const user = await this.userModel.findOne({ id: userId }).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.referralCode) {
      // Generate if doesn't exist
      return await this.generateReferralCode(userId);
    }

    return user.referralCode;
  }

  /**
   * Apply referral code when a new user registers
   */
  async applyReferralCode(
    inviteeUserId: string,
    referralCode: string,
  ): Promise<{ success: boolean; inviterId?: string; pointsAwarded?: number }> {
    try {
      if (!inviteeUserId || !inviteeUserId.trim()) {
        throw new BadRequestException('Invitee user ID is required');
      }

      if (!referralCode || !referralCode.trim()) {
        throw new BadRequestException('Referral code is required');
      }

      const trimmedCode = referralCode.trim().toUpperCase();

      // Find the inviter by referral code
      const inviter = await this.userModel
        .findOne({ referralCode: trimmedCode })
        .exec();

      if (!inviter) {
        throw new NotFoundException('Invalid referral code');
      }

      // Check if user is trying to use their own code
      if (inviter.id === inviteeUserId) {
        throw new BadRequestException('Cannot use your own referral code');
      }

      // Check if referral already exists
      const existingReferral = await this.referralModel
        .findOne({ inviteeId: inviteeUserId })
        .exec();

      if (existingReferral) {
        throw new BadRequestException('Referral code already applied');
      }

      // Create referral record
      const referral = new this.referralModel({
        inviteeId: inviteeUserId,
        inviterId: inviter.id,
        appliedAt: Date.now(),
        rewardsGranted: false,
      });
      await referral.save();

      // Award points to inviter
      const pointsToAward = 100; // Points for successful referral

      // Update inviter's loyalty points
      // First, try to find existing loyalty record
      const existingLoyalty = await this.loyaltyModel
        .findOne({ userId: inviter.id })
        .exec();

      if (existingLoyalty) {
        // If exists, increment points
        await this.loyaltyModel.findOneAndUpdate(
          { userId: inviter.id },
          { $inc: { points: pointsToAward } },
          { new: true },
        );
      } else {
        // If doesn't exist, create with initial points
        await this.loyaltyModel.create({
          userId: inviter.id,
          points: pointsToAward,
          streakDays: 0,
        });
      }

      // Create transaction record
      await this.txModel.create({
        userId: inviter.id,
        type: 'earned',
        amount: pointsToAward,
        description: 'რეფერალური კოდი',
        service: `ახალი იუზერი: ${inviteeUserId}`,
        ts: Date.now(),
        icon: 'people',
      });

      // Mark rewards as granted
      referral.rewardsGranted = true;
      await referral.save();

      return {
        success: true,
        inviterId: inviter.id,
        pointsAwarded: pointsToAward,
      };
    } catch (error: any) {
      console.error('Error in applyReferralCode:', {
        inviteeUserId,
        referralCode,
        error: error.message,
        stack: error.stack,
      });
      // Re-throw known exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      // Wrap unknown errors
      throw new BadRequestException(
        error.message || 'Failed to apply referral code',
      );
    }
  }

  /**
   * Get referral statistics for a user
   */
  async getReferralStats(userId: string): Promise<{
    totalReferrals: number;
    totalPointsEarned: number;
    referralCode: string;
  }> {
    const referralCode = await this.getReferralCode(userId);

    const referrals = await this.referralModel
      .find({ inviterId: userId })
      .exec();

    // Calculate total points earned from referrals
    const referralTransactions = await this.txModel
      .find({
        userId,
        description: 'რეფერალური კოდი',
        type: 'earned',
      })
      .exec();

    const totalPointsEarned = referralTransactions.reduce(
      (sum, tx) => sum + (tx.amount || 0),
      0,
    );

    return {
      totalReferrals: referrals.length,
      totalPointsEarned,
      referralCode: referralCode || '',
    };
  }

  /**
   * Get referral leaderboard - all users with pagination
   */
  async getReferralLeaderboard(
    userId?: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{
    leaderboard: Array<{
      userId: string;
      name: string;
      points: number;
      rank: number;
      referrals: number;
      isCurrentUser: boolean;
      createdAt: number;
    }>;
    total: number;
    hasMore: boolean;
  }> {
    // Get all referral transactions
    const referralTransactions = await this.txModel
      .find({
        description: 'რეფერალური კოდი',
        type: 'earned',
      })
      .exec();

    // Group by userId and sum points
    const pointsMap = new Map<string, number>();
    for (const tx of referralTransactions) {
      const current = pointsMap.get(tx.userId) || 0;
      pointsMap.set(tx.userId, current + (tx.amount || 0));
    }

    // Get referral counts
    const referralCounts = await this.referralModel
      .aggregate([
        {
          $group: {
            _id: '$inviterId',
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    const referralCountMap = new Map<string, number>();
    for (const item of referralCounts as Array<{
      _id: string;
      count: number;
    }>) {
      referralCountMap.set(item._id, item.count);
    }

    // Get ALL users from the database (with pagination support)
    const allUsers = await this.userModel
      .find({})
      .select('id firstName createdAt')
      .sort({ createdAt: -1 }) // Newest first
      .exec();

    // Build leaderboard entries for all users
    const allLeaderboard = allUsers.map((user) => ({
      userId: user.id,
      name: user.firstName || `მომხმარებელი ${user.id.slice(-4)}`,
      points: pointsMap.get(user.id) || 0,
      referrals: referralCountMap.get(user.id) || 0,
      createdAt: user.createdAt || Date.now(),
    }));

    // Sort: first by points (desc), then by createdAt (desc - newest first)
    allLeaderboard.sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points; // Higher points first
      }
      return b.createdAt - a.createdAt; // Newer users first if same points
    });

    // Assign ranks
    const leaderboardWithRanks = allLeaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1,
      isCurrentUser: userId ? entry.userId === userId : false,
    }));

    // Apply pagination
    const total = leaderboardWithRanks.length;
    const paginatedLeaderboard = leaderboardWithRanks.slice(
      offset,
      offset + limit,
    );
    const hasMore = offset + limit < total;

    return {
      leaderboard: paginatedLeaderboard,
      total,
      hasMore,
    };
  }
}
