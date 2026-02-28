import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, HydratedDocument } from 'mongoose';
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

      // Normalize referral code: remove spaces, convert to uppercase
      const normalizedCode = referralCode.replace(/\s+/g, '').toUpperCase();
      console.log('🔍 Applying referral code:', {
        inviteeUserId,
        originalCode: referralCode,
        normalizedCode,
      });

      // Try multiple search strategies
      let inviter: HydratedDocument<User> | null = null;

      // Strategy 1: Exact match (normalized)
      inviter = await this.userModel
        .findOne({ referralCode: normalizedCode })
        .exec();

      if (inviter) {
        console.log('✅ Found exact match (normalized):', {
          inviterId: inviter.id,
          referralCode: inviter.referralCode,
        });
      }

      // Strategy 2: Case-insensitive search (if exact match failed)
      if (!inviter) {
        console.log('⚠️ Exact match failed, trying case-insensitive search...');
        const allUsers = await this.userModel
          .find({ referralCode: { $exists: true, $ne: null } })
          .select('id referralCode')
          .exec();

        // Manual case-insensitive comparison (more reliable than $expr)
        for (const user of allUsers) {
          if (
            user.referralCode &&
            user.referralCode.replace(/\s+/g, '').toUpperCase() ===
              normalizedCode
          ) {
            inviter = user;
            console.log('✅ Found case-insensitive match:', {
              inviterId: inviter?.id,
              referralCode: inviter?.referralCode,
              matchedCode: normalizedCode,
            });
            break;
          }
        }
      }

      // Strategy 3: Fuzzy matching for common typos (if still not found)
      if (!inviter) {
        console.log(
          '⚠️ Case-insensitive search failed, trying fuzzy matching...',
        );
        const fuzzyVariations = this.generateFuzzyVariations(normalizedCode);
        console.log('🔍 Fuzzy variations:', fuzzyVariations);

        const allUsers = await this.userModel
          .find({ referralCode: { $exists: true, $ne: null } })
          .select('id referralCode')
          .exec();

        for (const variation of fuzzyVariations) {
          for (const user of allUsers) {
            if (
              user.referralCode &&
              user.referralCode.replace(/\s+/g, '').toUpperCase() === variation
            ) {
              inviter = user;
              console.log('✅ Found fuzzy match:', {
                original: normalizedCode,
                matched: variation,
                inviterId: inviter.id,
                inviterReferralCode: inviter.referralCode,
              });
              break;
            }
          }
          if (inviter) break;
        }
      }

      // If still not found, throw error
      if (!inviter) {
        console.log('❌ Referral code not found after all search strategies');
        throw new NotFoundException('Invalid referral code');
      }

      // Found inviter - continue with validation and reward logic
      // At this point, inviter is guaranteed to be non-null

      console.log('✅ Inviter found:', {
        inviterId: inviter.id,
        inviterReferralCode: inviter.referralCode,
      });

      // Check if user is trying to use their own code
      if (inviter.id === inviteeUserId) {
        console.log('❌ User trying to use own referral code:', {
          userId: inviteeUserId,
          referralCode: normalizedCode,
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
        const updatedLoyalty = await this.loyaltyModel.findOneAndUpdate(
          { userId: inviter.id },
          { $inc: { points: pointsToAward } },
          { new: true },
        );
        console.log('💰 [NORMAL PATH] Points added to existing loyalty:', {
          userId: inviter.id,
          pointsAwarded: pointsToAward,
          oldPoints: existingLoyalty.points,
          newPoints: updatedLoyalty?.points,
        });
      } else {
        // If doesn't exist, create with initial points
        const newLoyalty = await this.loyaltyModel.create({
          userId: inviter.id,
          points: pointsToAward,
          streakDays: 0,
        });
        console.log(
          '💰 [NORMAL PATH] New loyalty record created with points:',
          {
            userId: inviter.id,
            pointsAwarded: pointsToAward,
            newLoyaltyId: newLoyalty._id,
          },
        );
      }

      // Create transaction record
      const transaction = await this.txModel.create({
        userId: inviter.id,
        type: 'earned',
        amount: pointsToAward,
        description: 'რეფერალური კოდი',
        service: `ახალი იუზერი: ${inviteeUserId}`,
        ts: Date.now(),
        icon: 'people',
      });
      console.log('💰 [NORMAL PATH] Transaction created:', {
        transactionId: transaction._id,
        userId: inviter.id,
        amount: pointsToAward,
      });

      // Verify points were actually added
      const verifyLoyalty = await this.loyaltyModel
        .findOne({ userId: inviter.id })
        .exec();
      console.log('✅ [NORMAL PATH] Verification - Final loyalty points:', {
        userId: inviter.id,
        finalPoints: verifyLoyalty?.points,
        expectedPoints: (existingLoyalty?.points || 0) + pointsToAward,
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
   * Now uses getAllReferralsAnalysis to get accurate data
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
    const analysisData = await this.getAllReferralsAnalysis();

    const inviterStatsMap = new Map<
      string,
      {
        name: string;
        referrals: number;
        points: number;
      }
    >();

    // Get referral transactions for points calculation
    // Search for both possible descriptions to catch all referral transactions
    const referralTransactionsQuery = {
      $or: [
        { description: 'რეფერალური კოდი' },
        { description: { $regex: /referral|რეფერალ/i } },
      ],
      type: 'earned',
    };

    console.log(
      '🔍 [LEADERBOARD] Searching for referral transactions with query:',
      referralTransactionsQuery,
    );

    const referralTransactions = await this.txModel
      .find(referralTransactionsQuery)
      .exec();

    console.log('💰 [LEADERBOARD] Referral Transactions Found:', {
      totalTransactions: referralTransactions.length,
      transactionsByDescription: referralTransactions.reduce(
        (acc: any, tx: any) => {
          const desc = tx.description || 'unknown';
          acc[desc] = (acc[desc] || 0) + 1;
          return acc;
        },
        {},
      ),
      allTransactions: referralTransactions.map((tx: any) => ({
        _id: tx._id?.toString(),
        userId: tx.userId,
        amount: tx.amount,
        description: tx.description,
        type: tx.type,
        ts: tx.ts,
        date: tx.date,
      })),
      uniqueUsers: [
        ...new Set(referralTransactions.map((tx: any) => tx.userId)),
      ],
    });

    // Group points by userId - ONLY users with points > 0
    const pointsMap = new Map<string, number>();
    for (const tx of referralTransactions) {
      const amount = tx.amount || 0;
      if (amount > 0) {
        const current = pointsMap.get(tx.userId) || 0;
        pointsMap.set(tx.userId, current + amount);
      }
    }

    // Filter out users with 0 points
    const filteredPointsMap = new Map<string, number>();
    for (const [userId, points] of pointsMap.entries()) {
      if (points > 0) {
        filteredPointsMap.set(userId, points);
      }
    }

    console.log('💎 [LEADERBOARD] Points Map:', {
      totalTransactions: referralTransactions.length,
      totalUsersWithPoints: filteredPointsMap.size,
      allUsersWithPoints: Array.from(filteredPointsMap.entries()).map(
        ([userId, points]) => ({ userId, points }),
      ),
      top5Points: Array.from(filteredPointsMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([userId, points]) => ({ userId, points })),
    });

    // Use filtered points map
    const finalPointsMap = filteredPointsMap;

    // Process topInviters to build stats map
    console.log('🔨 [LEADERBOARD] Building inviterStatsMap from topInviters:', {
      topInvitersCount: analysisData.topInviters.length,
      topInvitersDetails: analysisData.topInviters.map((inv) => ({
        inviterId: inv.inviterId,
        inviterName: inv.inviterName,
        referralCount: inv.referralCount,
        pointsFromMap: finalPointsMap.get(inv.inviterId) || 0,
      })),
    });

    // Create a map for referral counts from topInviters
    const referralCountMap = new Map<string, number>();
    analysisData.topInviters.forEach((inviter) => {
      referralCountMap.set(inviter.inviterId, inviter.referralCount);
    });

    // Add all users who have points (not just topInviters)
    // This ensures everyone with points appears in leaderboard
    const allUsersWithPoints = Array.from(finalPointsMap.keys());
    console.log('⭐ [LEADERBOARD] Users with points:', {
      totalUsersWithPoints: allUsersWithPoints.length,
      userIds: allUsersWithPoints,
    });

    // Get user info for all users with points
    const usersWithPointsInfo = await this.userModel
      .find({ id: { $in: allUsersWithPoints } })
      .select('id firstName lastName')
      .exec();

    const userInfoMap = new Map<string, { name: string }>();
    usersWithPointsInfo.forEach((user) => {
      const userName =
        `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
        `მომხმარებელი ${user.id.slice(-4)}`;
      userInfoMap.set(user.id, { name: userName });
    });

    // Build inviterStatsMap with ALL users who have points > 0
    allUsersWithPoints.forEach((userId) => {
      const points = finalPointsMap.get(userId) || 0;

      // IMPORTANT: Only add users with points > 0
      if (points <= 0) {
        console.log(`⏭️ [LEADERBOARD] Skipping user ${userId} - has 0 points`);
        return;
      }

      const referrals = referralCountMap.get(userId) || 0;
      const userInfo = userInfoMap.get(userId);

      // Try to get name from topInviters first, then from userInfoMap
      const topInvitersEntry = analysisData.topInviters.find(
        (inv) => inv.inviterId === userId,
      );
      const name =
        topInvitersEntry?.inviterName ||
        userInfo?.name ||
        `მომხმარებელი ${userId.slice(-4)}`;

      inviterStatsMap.set(userId, {
        name,
        referrals,
        points,
      });
    });

    console.log(
      '✅ [LEADERBOARD] InviterStatsMap built with ALL users with points:',
      {
        totalEntries: inviterStatsMap.size,
        entries: Array.from(inviterStatsMap.entries()).map(
          ([userId, stats]) => ({
            userId,
            name: stats.name,
            referrals: stats.referrals,
            points: stats.points,
          }),
        ),
      },
    );

    console.log('👥 [LEADERBOARD] Inviter Stats Map:', {
      totalInviters: inviterStatsMap.size,
      allInviters: Array.from(inviterStatsMap.entries()).map(
        ([userId, stats]) => ({
          userId,
          name: stats.name,
          referrals: stats.referrals,
          points: stats.points,
        }),
      ),
      top5Inviters: Array.from(inviterStatsMap.entries())
        .slice(0, 5)
        .map(([userId, stats]) => ({
          userId,
          name: stats.name,
          referrals: stats.referrals,
          points: stats.points,
        })),
    });

    // Get users who have points (from inviterStatsMap) - these are the ones we want to show
    const userIdsWithPoints = Array.from(inviterStatsMap.keys());

    console.log('👤 [LEADERBOARD] Users with points to show:', {
      totalUsersWithPoints: userIdsWithPoints.length,
      userIds: userIdsWithPoints,
    });

    // Get user info for users with points
    const usersWithPoints = await this.userModel
      .find({ id: { $in: userIdsWithPoints } })
      .select('id firstName lastName createdAt')
      .exec();

    console.log('👤 [LEADERBOARD] Users fetched from DB:', {
      totalUsers: usersWithPoints.length,
      sampleUsers: usersWithPoints.slice(0, 5).map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        createdAt: u.createdAt,
      })),
    });

    // Build leaderboard entries - ONLY for users with points > 0
    const allLeaderboard = usersWithPoints
      .map((user) => {
        const inviterData = inviterStatsMap.get(user.id);

        // Double check: skip if no data or points <= 0
        if (!inviterData || inviterData.points <= 0) {
          console.log(
            `⏭️ [LEADERBOARD] Skipping user ${user.id} - no data or 0 points`,
          );
          return null;
        }

        const userName =
          `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
          `მომხმარებელი ${user.id.slice(-4)}`;

        const userCreatedAt = user.createdAt || Date.now();

        return {
          userId: user.id,
          name: inviterData.name || userName,
          points: inviterData.points,
          referrals: inviterData.referrals,
          createdAt: userCreatedAt,
        };
      })
      .filter((entry) => entry !== null) as Array<{
      userId: string;
      name: string;
      points: number;
      referrals: number;
      createdAt: number;
    }>;

    console.log('📋 [LEADERBOARD] All Leaderboard (before sort):', {
      totalEntries: allLeaderboard.length,
      top5BeforeSort: allLeaderboard.slice(0, 5).map((entry) => ({
        userId: entry.userId,
        name: entry.name,
        points: entry.points,
        referrals: entry.referrals,
      })),
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

    // Count users with points/referrals (all should have points > 0 now)
    const usersWithPointsCount = allLeaderboard.filter(
      (e) => e.points > 0,
    ).length;
    const usersWithReferralsCount = allLeaderboard.filter(
      (e) => e.referrals > 0,
    ).length;

    console.log('🔄 [LEADERBOARD] After Sorting:', {
      totalEntries: allLeaderboard.length,
      usersWithPoints: usersWithPointsCount,
      usersWithReferrals: usersWithReferralsCount,
      usersWithZeroPoints: allLeaderboard.length - usersWithPointsCount,
      top10AfterSort: allLeaderboard.slice(0, 10).map((entry, index) => ({
        rank: index + 1,
        userId: entry.userId,
        name: entry.name,
        points: entry.points,
        referrals: entry.referrals,
        createdAt: entry.createdAt,
      })),
      allUsersWithPoints: allLeaderboard
        .filter((e) => e.points > 0)
        .map((entry, index) => ({
          rank: index + 1,
          userId: entry.userId,
          name: entry.name,
          points: entry.points,
          referrals: entry.referrals,
        })),
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

    console.log('✅ [LEADERBOARD] Final Result:', {
      total,
      offset,
      limit,
      hasMore,
      returnedCount: paginatedLeaderboard.length,
      paginatedEntries: paginatedLeaderboard.map((entry) => ({
        rank: entry.rank,
        userId: entry.userId,
        name: entry.name,
        points: entry.points,
        referrals: entry.referrals,
        isCurrentUser: entry.isCurrentUser,
      })),
    });

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
      console.log('📈 [ANALYSIS] getAllReferralsAnalysis დაწყებულია');

      // ყველა რეფერალის მოტანა
      const allReferrals = await this.referralModel
        .find({})
        .sort({ createdAt: -1 })
        .exec();

      console.log('📊 [ANALYSIS] All Referrals from DB:', {
        totalReferrals: allReferrals.length,
        allReferralsDetails: allReferrals.map((r) => ({
          _id: r._id?.toString(),
          inviterId: r.inviterId,
          inviteeId: r.inviteeId,
          rewardsGranted: r.rewardsGranted,
          subscriptionEnabled: r.subscriptionEnabled,
          appliedAt: r.appliedAt,
        })),
        uniqueInviters: [...new Set(allReferrals.map((r) => r.inviterId))],
        uniqueInvitees: [...new Set(allReferrals.map((r) => r.inviteeId))],
      });

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

      console.log('🏆 [ANALYSIS] Top Inviters:', {
        totalInviters: topInviters.length,
        top5Inviters: topInviters.slice(0, 5).map((inv) => ({
          inviterId: inv.inviterId,
          inviterName: inv.inviterName,
          referralCount: inv.referralCount,
          subscriptionsEnabled: inv.subscriptionsEnabled,
          rewardsGranted: inv.rewardsGranted,
        })),
      });

      const result = {
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

      console.log('✅ [ANALYSIS] getAllReferralsAnalysis დასრულებულია:', {
        summary: result.summary,
        topInvitersCount: result.topInviters.length,
      });

      return result;
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
          inviterReferralCode: inviterInfo?.referralCode || 'კოდი არ მოიძებნა',
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
