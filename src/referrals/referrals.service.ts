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
   * Get all users who used a specific referral code
   */
  async getReferralCodeUsers(referralCode: string): Promise<{
    inviterId: string;
    inviterName: string;
    users: Array<{
      userId: string;
      name: string;
      appliedAt: number;
      subscriptionEnabled: boolean;
      rewardsGranted: boolean;
      firstBookingAt?: number;
    }>;
  }> {
    const trimmedCode = referralCode.trim().toUpperCase();

    // Find the inviter by referral code
    const inviter = await this.userModel
      .findOne({ referralCode: trimmedCode })
      .exec();

    if (!inviter) {
      // Try case-insensitive search
      const inviterCaseInsensitive = await this.userModel
        .findOne({
          $expr: {
            $eq: [{ $toUpper: '$referralCode' }, trimmedCode],
          },
        })
        .exec();

      if (!inviterCaseInsensitive) {
        throw new NotFoundException('Referral code not found');
      }

      // Find all referrals for this inviter
      const referrals = await this.referralModel
        .find({ inviterId: inviterCaseInsensitive.id })
        .sort({ appliedAt: -1 })
        .exec();

      // Get user information for all invitees
      const inviteeIds = referrals.map((r) => r.inviteeId);
      const users = await this.userModel
        .find({ id: { $in: inviteeIds } })
        .select('id firstName lastName')
        .exec();

      const userMap = new Map<string, { name: string }>();
      users.forEach((user) => {
        userMap.set(user.id, {
          name:
            `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
            `მომხმარებელი ${user.id.slice(-4)}`,
        });
      });

      const usersList = referrals.map((ref) => {
        const userInfo = userMap.get(ref.inviteeId);
        return {
          userId: ref.inviteeId,
          name: userInfo?.name || ref.inviteeId,
          appliedAt: ref.appliedAt,
          subscriptionEnabled: ref.subscriptionEnabled,
          rewardsGranted: ref.rewardsGranted,
          firstBookingAt: ref.firstBookingAt,
        };
      });

      return {
        inviterId: inviterCaseInsensitive.id,
        inviterName:
          `${inviterCaseInsensitive.firstName || ''} ${inviterCaseInsensitive.lastName || ''}`.trim() ||
          `მომხმარებელი ${inviterCaseInsensitive.id.slice(-4)}`,
        users: usersList,
      };
    }

    // Find all referrals for this inviter
    const referrals = await this.referralModel
      .find({ inviterId: inviter.id })
      .sort({ appliedAt: -1 })
      .exec();

    // Get user information for all invitees
    const inviteeIds = referrals.map((r) => r.inviteeId);
    const users = await this.userModel
      .find({ id: { $in: inviteeIds } })
      .select('id firstName lastName')
      .exec();

    const userMap = new Map<string, { name: string }>();
    users.forEach((user) => {
      userMap.set(user.id, {
        name:
          `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
          `მომხმარებელი ${user.id.slice(-4)}`,
      });
    });

    const usersList = referrals.map((ref) => {
      const userInfo = userMap.get(ref.inviteeId);
      return {
        userId: ref.inviteeId,
        name: userInfo?.name || ref.inviteeId,
        appliedAt: ref.appliedAt,
        subscriptionEnabled: ref.subscriptionEnabled,
        rewardsGranted: ref.rewardsGranted,
        firstBookingAt: ref.firstBookingAt,
      };
    });

    return {
      inviterId: inviter.id,
      inviterName:
        `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() ||
        `მომხმარებელი ${inviter.id.slice(-4)}`,
      users: usersList,
    };
  }

  /**
   * Get all users who used referral code of a specific user (by userId)
   * Admin Panel endpoint - returns list of all referrals for a user
   */
  async getReferralsByUserId(userId: string): Promise<{
    inviterId: string;
    inviterName: string;
    referralCode: string;
    users: Array<{
      userId: string;
      name: string;
      appliedAt: number;
      subscriptionEnabled: boolean;
      rewardsGranted: boolean;
      firstBookingAt?: number;
    }>;
  }> {
    // Find the user
    const inviter = await this.userModel.findOne({ id: userId }).exec();

    if (!inviter) {
      throw new NotFoundException('User not found');
    }

    // Get referral code
    const referralCode =
      inviter.referralCode || (await this.getReferralCode(userId)) || '';

    // Find all referrals for this inviter
    const referrals = await this.referralModel
      .find({ inviterId: userId })
      .sort({ appliedAt: -1 })
      .exec();

    // Get user information for all invitees
    const inviteeIds = referrals.map((r) => r.inviteeId);
    const users = await this.userModel
      .find({ id: { $in: inviteeIds } })
      .select('id firstName lastName')
      .exec();

    const userMap = new Map<string, { name: string }>();
    users.forEach((user) => {
      userMap.set(user.id, {
        name:
          `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
          `მომხმარებელი ${user.id.slice(-4)}`,
      });
    });

    const usersList = referrals.map((ref) => {
      const userInfo = userMap.get(ref.inviteeId);
      return {
        userId: ref.inviteeId,
        name: userInfo?.name || ref.inviteeId,
        appliedAt: ref.appliedAt,
        subscriptionEnabled: ref.subscriptionEnabled,
        rewardsGranted: ref.rewardsGranted,
        firstBookingAt: ref.firstBookingAt,
      };
    });

    return {
      inviterId: inviter.id,
      inviterName:
        `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() ||
        `მომხმარებელი ${inviter.id.slice(-4)}`,
      referralCode: referralCode,
      users: usersList,
    };
  }

  /**
   * Get detailed referral usage history/logs for a specific user
   * Admin Panel endpoint - returns detailed history with timestamps
   */
  async getReferralUsageHistory(userId: string): Promise<{
    inviterId: string;
    inviterName: string;
    referralCode: string;
    totalReferrals: number;
    history: Array<{
      referralId: string;
      inviteeId: string;
      inviteeName: string;
      appliedAt: number;
      appliedAtFormatted: string;
      subscriptionEnabled: boolean;
      rewardsGranted: boolean;
      firstBookingAt?: number;
      firstBookingAtFormatted?: string;
      createdAt: Date;
      updatedAt: Date;
      daysSinceApplied: number;
    }>;
  }> {
    // Find the user
    const inviter = await this.userModel.findOne({ id: userId }).exec();

    if (!inviter) {
      throw new NotFoundException('User not found');
    }

    // Get referral code
    const referralCode =
      inviter.referralCode || (await this.getReferralCode(userId)) || '';

    // Find all referrals for this inviter with full document info
    const referrals = await this.referralModel
      .find({ inviterId: userId })
      .sort({ appliedAt: -1 })
      .exec();

    // Get user information for all invitees
    const inviteeIds = referrals.map((r) => r.inviteeId);
    const users = await this.userModel
      .find({ id: { $in: inviteeIds } })
      .select('id firstName lastName')
      .exec();

    const userMap = new Map<string, { name: string }>();
    users.forEach((user) => {
      userMap.set(user.id, {
        name:
          `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
          `მომხმარებელი ${user.id.slice(-4)}`,
      });
    });

    const formatDate = (timestamp: number): string => {
      const date = new Date(timestamp);
      return date.toLocaleDateString('ka-GE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const now = Date.now();

    const history = referrals.map((ref) => {
      const refDoc = ref as any; // mongoose document with timestamps
      const userInfo = userMap.get(ref.inviteeId);
      const daysSinceApplied = Math.floor(
        (now - ref.appliedAt) / (1000 * 60 * 60 * 24),
      );

      return {
        referralId: ref._id.toString(),
        inviteeId: ref.inviteeId,
        inviteeName: userInfo?.name || ref.inviteeId,
        appliedAt: ref.appliedAt,
        appliedAtFormatted: formatDate(ref.appliedAt),
        subscriptionEnabled: ref.subscriptionEnabled,
        rewardsGranted: ref.rewardsGranted,
        firstBookingAt: ref.firstBookingAt,
        firstBookingAtFormatted: ref.firstBookingAt
          ? formatDate(ref.firstBookingAt)
          : undefined,
        createdAt: refDoc.createdAt as Date,
        updatedAt: refDoc.updatedAt as Date,
        daysSinceApplied,
      };
    });

    return {
      inviterId: inviter.id,
      inviterName:
        `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() ||
        `მომხმარებელი ${inviter.id.slice(-4)}`,
      referralCode: referralCode,
      totalReferrals: referrals.length,
      history,
    };
  }

  /**
   * Get referral leaderboard - all users with pagination
   * Now uses getAllReferralsHistory to get accurate data
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
    // Get all referral history
    const historyData = await this.getAllReferralsHistory();

    // Group referrals by inviterId
    const inviterMap = new Map<
      string,
      {
        name: string;
        referrals: number;
        points: number;
        createdAt: number;
      }
    >();

    // Process history to build inviter stats
    historyData.history.forEach((item) => {
      const existing = inviterMap.get(item.inviterId) || {
        name: item.inviterName,
        referrals: 0,
        points: 0,
        createdAt: item.createdAt.getTime(),
      };

      existing.referrals += 1;
      // Award points: 100 points per referral (if rewardsGranted)
      if (item.rewardsGranted) {
        existing.points += 100;
      }

      inviterMap.set(item.inviterId, existing);
    });

    // Get all users to include those without referrals
    const allUsers = await this.userModel
      .find({})
      .select('id firstName lastName createdAt')
      .exec();

    // Build leaderboard entries
    const allLeaderboard = allUsers.map((user) => {
      const inviterData = inviterMap.get(user.id);
      const userName =
        `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
        `მომხმარებელი ${user.id.slice(-4)}`;

      const userCreatedAt = user.createdAt || Date.now();

      return {
        userId: user.id,
        name: inviterData?.name || userName,
        points: inviterData?.points || 0,
        referrals: inviterData?.referrals || 0,
        createdAt: inviterData?.createdAt || userCreatedAt,
      };
    });

    // Sort: first by points (desc), then by referrals (desc), then by createdAt (desc)
    allLeaderboard.sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points; // Higher points first
      }
      if (b.referrals !== a.referrals) {
        return b.referrals - a.referrals; // More referrals first
      }
      return b.createdAt - a.createdAt; // Newer users first if same points/referrals
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

  /**
   * Get complete referral usage history - all referrals ever used
   * Admin Panel endpoint - returns detailed history of all referral code usages
   */
  async getAllReferralsHistory(): Promise<{
    summary: {
      totalReferrals: number;
      totalInviters: number;
      totalInvitees: number;
      subscriptionsEnabled: number;
      rewardsGranted: number;
      pendingRewards: number;
    };
    history: Array<{
      referralId: string;
      inviterId: string;
      inviterName: string;
      inviterReferralCode: string;
      inviteeId: string;
      inviteeName: string;
      appliedAt: number;
      appliedAtFormatted: string;
      subscriptionEnabled: boolean;
      rewardsGranted: boolean;
      firstBookingAt?: number;
      firstBookingAtFormatted?: string;
      createdAt: Date;
      updatedAt: Date;
      daysSinceApplied: number;
    }>;
  }> {
    try {
      // ყველა რეფერალის მოტანა
      const allReferrals = await this.referralModel
        .find({})
        .sort({ appliedAt: -1 })
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
            `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
            `მომხმარებელი ${user.id.slice(-4)}`,
          referralCode: user.referralCode,
        });
      });

      const formatDate = (timestamp: number): string => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('ka-GE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      };

      const now = Date.now();

      // დეტალური ისტორია
      const history = allReferrals.map((ref) => {
        const refDoc = ref as any; // mongoose document with timestamps
        const inviterInfo = userMap.get(ref.inviterId);
        const inviteeInfo = userMap.get(ref.inviteeId);
        const daysSinceApplied = Math.floor(
          (now - ref.appliedAt) / (1000 * 60 * 60 * 24),
        );

        return {
          referralId: ref._id.toString(),
          inviterId: ref.inviterId,
          inviterName: inviterInfo?.name || ref.inviterId,
          inviterReferralCode:
            inviterInfo?.referralCode || 'კოდი არ მოიძებნა',
          inviteeId: ref.inviteeId,
          inviteeName: inviteeInfo?.name || ref.inviteeId,
          appliedAt: ref.appliedAt,
          appliedAtFormatted: formatDate(ref.appliedAt),
          subscriptionEnabled: ref.subscriptionEnabled,
          rewardsGranted: ref.rewardsGranted,
          firstBookingAt: ref.firstBookingAt,
          firstBookingAtFormatted: ref.firstBookingAt
            ? formatDate(ref.firstBookingAt)
            : undefined,
          createdAt: refDoc.createdAt as Date,
          updatedAt: refDoc.updatedAt as Date,
          daysSinceApplied,
        };
      });

      return {
        summary: {
          totalReferrals: allReferrals.length,
          totalInviters: uniqueInviters,
          totalInvitees: uniqueInvitees,
          subscriptionsEnabled,
          rewardsGranted,
          pendingRewards,
        },
        history,
      };
    } catch (error) {
      console.error('❌ Error in getAllReferralsHistory:', error);
      throw new BadRequestException(
        'რეფერალების ისტორიის მიღებისას მოხდა შეცდომა',
      );
    }
  }
}
