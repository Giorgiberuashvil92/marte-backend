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
   * Generate fuzzy variations of a referral code for typo tolerance
   * Common typos: 0/O, 1/I, 5/S, 2/Z
   */
  private generateFuzzyVariations(code: string): string[] {
    const variations = new Set<string>();
    variations.add(code); // Include original

    // Common character substitutions
    const substitutions: { [key: string]: string[] } = {
      '0': ['O', 'o'],
      O: ['0'],
      o: ['0', 'O'],
      '1': ['I', 'l', 'L'],
      I: ['1', 'l', 'L'],
      l: ['1', 'I', 'L'],
      L: ['1', 'I', 'l'],
      '5': ['S', 's'],
      S: ['5'],
      s: ['5', 'S'],
      '2': ['Z', 'z'],
      Z: ['2'],
      z: ['2', 'Z'],
    };

    // Generate variations by replacing each character with possible substitutions
    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      const subs = substitutions[char] || [];
      for (const sub of subs) {
        const variation = code.slice(0, i) + sub + code.slice(i + 1);
        variations.add(variation.toUpperCase());
      }
    }

    return Array.from(variations);
  }

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
      console.log('🔍 Applying referral code:', {
        inviteeUserId,
        originalCode: referralCode,
        trimmedCode,
      });

      // Find the inviter by referral code
      const inviter = await this.userModel
        .findOne({ referralCode: trimmedCode })
        .exec();

      console.log('🔍 Inviter lookup result:', {
        found: !!inviter,
        inviterId: inviter?.id as string,
        inviterReferralCode: inviter?.referralCode,
      });

      // If not found, try case-insensitive search as fallback
      if (!inviter) {
        console.log(
          '⚠️ Case-sensitive search failed, trying case-insensitive...',
        );
        const inviterCaseInsensitive = await this.userModel
          .findOne({
            $expr: {
              $eq: [{ $toUpper: '$referralCode' }, trimmedCode],
            },
          })
          .exec();

        console.log('🔍 Case-insensitive search result:', {
          found: !!inviterCaseInsensitive,
          inviterId: inviterCaseInsensitive?.id,
          inviterReferralCode: inviterCaseInsensitive?.referralCode,
        });

        if (!inviterCaseInsensitive) {
          // Debug: Check if any referral codes exist
          const sampleCodes = await this.userModel
            .find({ referralCode: { $exists: true, $ne: null } })
            .limit(5)
            .select('id referralCode')
            .exec();
          console.log('🔍 Sample referral codes in DB:', sampleCodes);

          // Try fuzzy matching for common typos (0 vs O, 1 vs I, etc.)
          console.log('🔍 Trying fuzzy matching for common typos...');
          const fuzzyVariations = this.generateFuzzyVariations(trimmedCode);
          console.log('🔍 Fuzzy variations:', fuzzyVariations);

          for (const variation of fuzzyVariations) {
            const fuzzyMatch = await this.userModel
              .findOne({ referralCode: variation })
              .exec();

            if (fuzzyMatch) {
              console.log('✅ Found fuzzy match:', {
                original: trimmedCode,
                matched: variation,
                inviterId: fuzzyMatch.id as string,
              });
              // Use fuzzy match
              const inviterToUse = fuzzyMatch;
              if (inviterToUse.id === inviteeUserId) {
                throw new BadRequestException(
                  'Cannot use your own referral code',
                );
              }

              const existingReferral = await this.referralModel
                .findOne({ inviteeId: inviteeUserId })
                .exec();

              if (existingReferral) {
                throw new BadRequestException('Referral code already applied');
              }

              const referral = new this.referralModel({
                inviteeId: inviteeUserId,
                inviterId: inviterToUse.id,
                appliedAt: Date.now(),
                rewardsGranted: false,
              });
              await referral.save();

              const pointsToAward = 100;

              // Check if loyalty record exists
              const existingLoyalty = await this.loyaltyModel
                .findOne({ userId: inviterToUse.id })
                .exec();

              if (existingLoyalty) {
                // If exists, increment points
                await this.loyaltyModel.findOneAndUpdate(
                  { userId: inviterToUse.id },
                  { $inc: { points: pointsToAward } },
                  { new: true },
                );
              } else {
                // If doesn't exist, create with initial points
                await this.loyaltyModel.create({
                  userId: inviterToUse.id,
                  points: pointsToAward,
                  streakDays: 0,
                });
              }

              await this.txModel.create({
                userId: inviterToUse.id,
                type: 'earned',
                amount: pointsToAward,
                description: 'რეფერალური კოდი',
                service: `ახალი იუზერი: ${inviteeUserId}`,
                ts: Date.now(),
                icon: 'people',
              });

              referral.rewardsGranted = true;
              await referral.save();

              console.log(
                '✅ Referral code applied successfully (fuzzy match):',
                {
                  inviteeUserId,
                  inviterId: inviterToUse.id,
                  pointsAwarded: pointsToAward,
                  matchedCode: variation,
                },
              );

              return {
                success: true,
                inviterId: inviterToUse.id,
                pointsAwarded: pointsToAward,
              };
            }
          }

          throw new NotFoundException('Invalid referral code');
        }

        // Use case-insensitive result
        const inviterToUse = inviterCaseInsensitive;
        // Continue with the rest of the logic using inviterToUse
        if (inviterToUse.id === inviteeUserId) {
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
          inviterId: inviterToUse.id,
          appliedAt: Date.now(),
          rewardsGranted: false,
        });
        await referral.save();

        // Award points to inviter
        const pointsToAward = 100;

        // Update inviter's loyalty points
        // Check if loyalty record exists
        const existingLoyalty = await this.loyaltyModel
          .findOne({ userId: inviterToUse.id })
          .exec();

        if (existingLoyalty) {
          // If exists, increment points
          await this.loyaltyModel.findOneAndUpdate(
            { userId: inviterToUse.id },
            { $inc: { points: pointsToAward } },
            { new: true },
          );
        } else {
          // If doesn't exist, create with initial points
          await this.loyaltyModel.create({
            userId: inviterToUse.id,
            points: pointsToAward,
            streakDays: 0,
          });
        }

        // Create transaction record
        const transaction = new this.txModel({
          userId: inviterToUse.id,
          type: 'earned',
          amount: pointsToAward,
          description: `Referral bonus for ${inviteeUserId}`,
          date: new Date().toISOString(),
        });
        await transaction.save();

        console.log('✅ Referral code applied successfully:', {
          inviteeUserId,
          inviterId: inviterToUse.id,
          pointsAwarded: pointsToAward,
        });

        return {
          success: true,
          inviterId: inviterToUse.id,
          pointsAwarded: pointsToAward,
        };
      }

      // Check if user is trying to use their own code
      if (inviter.id === inviteeUserId) {
        console.log('❌ User trying to use own referral code:', {
          userId: inviteeUserId,
          referralCode: trimmedCode,
        });
        throw new BadRequestException('Cannot use your own referral code');
      }

      // Check if referral already exists
      const existingReferral = await this.referralModel
        .findOne({ inviteeId: inviteeUserId })
        .exec();

      if (existingReferral) {
        console.log('❌ Referral code already applied:', {
          inviteeUserId,
          existingReferral: existingReferral.inviterId,
        });
        throw new BadRequestException('Referral code already applied');
      }

      console.log('✅ Valid referral code found, creating referral record...');

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

      console.log('💰 Awarding points to inviter:', {
        inviterId: inviter.id,
        points: pointsToAward,
      });

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

      console.log('✅ Referral code applied successfully (normal path):', {
        inviteeUserId,
        inviterId: inviter.id,
        pointsAwarded: pointsToAward,
      });

      return {
        success: true,
        inviterId: inviter.id,
        pointsAwarded: pointsToAward,
      };
    } catch (error: any) {
      console.error('❌ Error in applyReferralCode:', {
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

  /**
   * რეფერალების სრული ანალიზი - ყველა რეფერალის დეტალური ინფორმაცია
   */
  async getAllReferralsAnalysis(): Promise<{
    summary: {
      totalReferrals: number;
      totalInviters: number;
      totalInvitees: number;
      subscriptionsEnabled: number;
      rewardsGranted: number;
      pendingRewards: number;
    };
    referrals: Array<{
      _id: string;
      inviteeId: string;
      inviterId: string;
      appliedAt: number;
      subscriptionEnabled: boolean;
      rewardsGranted: boolean;
      firstBookingAt?: number;
      createdAt: Date;
      updatedAt: Date;
      inviteeName?: string;
      inviterName?: string;
      inviterReferralCode?: string;
    }>;
    topInviters: Array<{
      inviterId: string;
      inviterName?: string;
      referralCount: number;
      subscriptionsEnabled: number;
      rewardsGranted: number;
    }>;
  }> {
    try {
      // ყველა რეფერალის მოტანა
      const allReferrals = await this.referralModel
        .find({})
        .sort({ createdAt: -1 })
        .exec();

      // უნიკალური inviter-ების რაოდენობა
      const uniqueInviters = new Set(allReferrals.map((r) => r.inviterId)).size;

      // უნიკალური invitee-ების რაოდენობა
      const uniqueInvitees = new Set(allReferrals.map((r) => r.inviteeId)).size;

      // subscription enabled-ების რაოდენობა
      const subscriptionsEnabled = allReferrals.filter(
        (r) => r.subscriptionEnabled,
      ).length;

      // rewards granted-ების რაოდენობა
      const rewardsGranted = allReferrals.filter(
        (r) => r.rewardsGranted,
      ).length;

      // pending rewards (subscription enabled მაგრამ rewards არ არის granted)
      const pendingRewards = allReferrals.filter(
        (r) => r.subscriptionEnabled && !r.rewardsGranted,
      ).length;

      // ვიპოვოთ ყველა userId რომელიც გვჭირდება
      const allUserIds = new Set<string>();
      allReferrals.forEach((r) => {
        allUserIds.add(r.inviteeId);
        allUserIds.add(r.inviterId);
      });

      // ვიპოვოთ იუზერების ინფორმაცია
      const users = await this.userModel
        .find({ id: { $in: Array.from(allUserIds) } })
        .select('id firstName lastName referralCode')
        .exec();

      const userMap = new Map<
        string,
        { name: string; referralCode?: string }
      >();
      users.forEach((user) => {
        userMap.set(user.id, {
          name:
            `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.id,
          referralCode: user.referralCode,
        });
      });

      // დეტალური რეფერალების სია
      const referralsDetails = allReferrals.map((ref) => {
        const refDoc = ref as any; // mongoose document with timestamps
        return {
          _id: ref._id.toString(),
          inviteeId: ref.inviteeId,
          inviterId: ref.inviterId,
          appliedAt: ref.appliedAt,
          subscriptionEnabled: ref.subscriptionEnabled,
          rewardsGranted: ref.rewardsGranted,
          firstBookingAt: ref.firstBookingAt,
          createdAt: refDoc.createdAt as Date,
          updatedAt: refDoc.updatedAt as Date,
          inviteeName: userMap.get(ref.inviteeId)?.name || ref.inviteeId,
          inviterName: userMap.get(ref.inviterId)?.name || ref.inviterId,
          inviterReferralCode: userMap.get(ref.inviterId)?.referralCode,
        };
      });

      // Top inviters (რომლებსაც ყველაზე მეტი რეფერალი აქვთ)
      const inviterStats = new Map<
        string,
        {
          count: number;
          subscriptionsEnabled: number;
          rewardsGranted: number;
        }
      >();

      allReferrals.forEach((ref) => {
        const stats = inviterStats.get(ref.inviterId) || {
          count: 0,
          subscriptionsEnabled: 0,
          rewardsGranted: 0,
        };
        stats.count++;
        if (ref.subscriptionEnabled) stats.subscriptionsEnabled++;
        if (ref.rewardsGranted) stats.rewardsGranted++;
        inviterStats.set(ref.inviterId, stats);
      });

      const topInviters = Array.from(inviterStats.entries())
        .map(([inviterId, stats]) => {
          const userInfo = userMap.get(inviterId);
          return {
            inviterId,
            inviterName: userInfo?.name || inviterId,
            referralCount: stats.count,
            subscriptionsEnabled: stats.subscriptionsEnabled,
            rewardsGranted: stats.rewardsGranted,
          };
        })
        .sort((a, b) => b.referralCount - a.referralCount);

      return {
        summary: {
          totalReferrals: allReferrals.length,
          totalInviters: uniqueInviters,
          totalInvitees: uniqueInvitees,
          subscriptionsEnabled,
          rewardsGranted,
          pendingRewards,
        },
        referrals: referralsDetails,
        topInviters,
      };
    } catch (error) {
      console.error('❌ Error in getAllReferralsAnalysis:', error);
      throw new BadRequestException('რეფერალების ანალიზისას მოხდა შეცდომა');
    }
  }
}
