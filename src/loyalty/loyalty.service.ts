import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Loyalty } from '../schemas/loyalty.schema';
import { LoyaltyTransaction } from '../schemas/loyalty-transaction.schema';
import { Referral } from '../schemas/referral.schema';

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectModel(Loyalty.name) private readonly loyaltyModel: Model<Loyalty>,
    @InjectModel(LoyaltyTransaction.name)
    private readonly txModel: Model<LoyaltyTransaction>,
    @InjectModel(Referral.name)
    private readonly referralModel: Model<Referral>,
  ) {}

  async getSummary(userId: string) {
    const doc = await this.loyaltyModel
      .findOneAndUpdate(
        { userId },
        {
          $setOnInsert: {
            userId,
            points: 0,
            streakDays: 0,
            updatedAt: Date.now(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean();
    const points = doc.points || 0;
    const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
    const tierIndex = Math.min(tiers.length - 1, Math.floor(points / 500));
    const tier = tiers[tierIndex];
    const nextTierPoints = (tierIndex + 1) * 500 + 500;
    const streakDays = doc.streakDays || 0;
    return { points, tier, nextTierPoints, streakDays };
  }

  async getTransactions(userId: string, limit = 20) {
    const rows = await this.txModel
      .find({ userId })
      .sort({ ts: -1 })
      .limit(limit)
      .lean();
    return rows.map((r) => ({
      id: String((r as any)._id ?? ''),
      type: r.type,
      amount: r.amount,
      description: r.description,
      date: new Date(r.ts || Date.now()).toISOString(),
      service: r.service,
      icon: r.icon || 'pricetag',
    }));
  }

  async getRewards(userId: string) {
    const summary = await this.getSummary(userId);
    const can = (req: number) => summary.points >= req;
    return [
      {
        id: 'r1',
        title: '10% ფასდაკლება',
        description: 'ყველა სამრეცხაო სერვისზე',
        pointsRequired: 500,
        icon: 'pricetag',
        category: 'discount',
        isAvailable: can(500),
        discount: 10,
        expiryDate: this.exp(),
      },
      {
        id: 'r2',
        title: 'უფასო ვაქსი',
        description: 'პრემიუმ ვაქსის სერვისი',
        pointsRequired: 1000,
        icon: 'car',
        category: 'freebie',
        isAvailable: can(1000),
        expiryDate: this.exp(),
      },
      {
        id: 'r3',
        title: 'VIP სტატუსი',
        description: '1 თვის VIP სტატუსი',
        pointsRequired: 2000,
        icon: 'diamond',
        category: 'upgrade',
        isAvailable: can(2000),
        expiryDate: this.exp(),
      },
      {
        id: 'r4',
        title: 'ბონუს ქულები',
        description: '+200 ბონუს ქულა',
        pointsRequired: 300,
        icon: 'gift',
        category: 'bonus',
        isAvailable: can(300),
        expiryDate: this.exp(),
      },
    ];
  }

  async redeem(userId: string, rewardId: string) {
    const rewards = await this.getRewards(userId);
    const reward = rewards.find((r) => r.id === rewardId);
    const cost = reward?.pointsRequired ?? 0;
    // atomically decrement points (floor at 0)
    const current = await this.loyaltyModel.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: { userId, points: 0, streakDays: 0 },
        $inc: { points: -cost },
      },
      { upsert: true, new: true },
    );
    if (current.points < 0) {
      // revert if not enough
      await this.loyaltyModel.updateOne({ userId }, { $inc: { points: cost } });
      throw new Error('not_enough_points');
    }
    await this.txModel.create({
      userId,
      type: 'spent',
      amount: cost,
      description: reward?.title || 'Reward redeem',
      service: reward?.description,
      ts: Date.now(),
      icon: reward?.icon || 'pricetag',
    });
    const points = current.points;
    const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
    const tierIndex = Math.min(tiers.length - 1, Math.floor(points / 500));
    const tier = tiers[tierIndex];
    const nextTierPoints = (tierIndex + 1) * 500 + 500;
    return {
      ok: true,
      summary: {
        points,
        tier,
        nextTierPoints,
        streakDays: current.streakDays || 0,
      },
    };
  }

  async getLeaderboard(userId: string) {
    // Top 20 by points from DB; include current user if not in top
    const top = await this.loyaltyModel
      .find({}, { userId: 1, points: 1 })
      .sort({ points: -1 })
      .limit(20)
      .lean();

    const ids = new Set(top.map((t) => t.userId));
    if (!ids.has(userId)) {
      const me = await this.loyaltyModel
        .findOne({ userId }, { userId: 1, points: 1 })
        .lean();
      if (me) top.push(me);
    }

    const sorted = top.sort((a, b) => (b.points || 0) - (a.points || 0));
    return sorted.map((u, idx) => ({
      id: u.userId,
      name: u.userId === userId ? 'მომხმარებელი' : `User ${u.userId.slice(-4)}`,
      points: u.points || 0,
      rank: idx + 1,
      isCurrentUser: u.userId === userId,
    }));
  }

  async getFriends(userId: string) {
    const seed = this.hash(userId);
    const base = [
      { name: 'გიორგი ბერიძე' },
      { name: 'ანა კვარაცხელია' },
      { name: 'დავით ჩიქოვანი' },
      { name: 'ნინო ბაღაშვილი' },
      { name: 'საბა ცქიტიშვილი' },
    ];
    return base.map((b, i) => ({
      id: `f${i + 1}`,
      name: b.name,
      points: 400 + ((seed >> (i + 2)) % 2600),
      isOnline: (seed + i) % 2 === 0,
      lastActive:
        (seed + i) % 2 === 0 ? 'ახლა' : `${(seed % 5) + 1} საათის წინ`,
    }));
  }

  async getAchievements(userId: string) {
    const seed = this.hash(userId);
    const progress = (m: number) => Math.min(m, seed % (m + 1));
    return [
      {
        id: 'a1',
        title: 'პირველი ვიზიტი',
        description: 'პირველი სამრეცხაო სერვისი',
        icon: 'star',
        isUnlocked: true,
        pointsReward: 50,
      },
      {
        id: 'a2',
        title: 'ლოიალური მომხმარებელი',
        description: '10 სერვისი გამოიყენე',
        icon: 'heart',
        isUnlocked: progress(10) >= 10,
        pointsReward: 100,
        progress: progress(10),
        maxProgress: 10,
      },
      {
        id: 'a3',
        title: 'VIP სტატუსი',
        description: '1000 ქულა მიიღე',
        icon: 'diamond',
        isUnlocked: progress(1000) >= 1000,
        pointsReward: 200,
        progress: Math.min(1000, 500 + (seed % 600)),
        maxProgress: 1000,
      },
      {
        id: 'a4',
        title: 'მეგობრების მოწვევა',
        description: '5 მეგობარი მოიწვიე',
        icon: 'people',
        isUnlocked: progress(5) >= 5,
        pointsReward: 150,
        progress: progress(5),
        maxProgress: 5,
      },
    ];
  }

  private exp() {
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    return d.toISOString().slice(0, 10);
  }

  private hash(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  // Missions (static): daily check-in 100 points
  async getMissions(userId: string) {
    const now = new Date();
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const claimedToday = await this.txModel
      .findOne({
        userId,
        type: 'earned',
        description: 'მისიის ჯილდო (m1)',
        ts: { $gte: start, $lt: end },
      })
      .lean();

    return [
      {
        id: 'm1',
        title: 'ყოველდღიური ჩექინი',
        icon: 'calendar',
        progress: claimedToday ? 1 : 0,
        target: 1,
        reward: 100,
      },
    ];
  }

  async claimMission(userId: string, missionId: string) {
    // Only static daily check-in (m1) with 100 points
    if (missionId !== 'm1') throw new Error('unknown_mission');
    const add = 100;

    const now = new Date();
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const already = await this.txModel.findOne({
      userId,
      type: 'earned',
      description: 'მისიის ჯილდო (m1)',
      ts: { $gte: start, $lt: end },
    });
    if (already) throw new Error('already_claimed_today');
    const updated = await this.loyaltyModel.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: { userId, points: 0, streakDays: 0 },
        $inc: { points: add },
      },
      { upsert: true, new: true },
    );
    if (add > 0) {
      await this.txModel.create({
        userId,
        type: 'earned',
        amount: add,
        description: `მისიის ჯილდო (m1)`,
        ts: Date.now(),
        icon: 'gift',
      });
    }
    const points = updated.points || 0;
    const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
    const tierIndex = Math.min(tiers.length - 1, Math.floor(points / 500));
    const tier = tiers[tierIndex];
    const nextTierPoints = (tierIndex + 1) * 500 + 500;
    return {
      ok: true,
      missionId,
      newSummary: {
        points,
        tier,
        nextTierPoints,
        streakDays: updated.streakDays || 0,
      },
    };
  }

  // Referral: generate/get inviter code (use userId directly for now)
  async getReferralCode(userId: string) {
    return { code: userId };
  }

  // Referral: invitee applies code
  async applyReferral(inviteeId: string, code: string) {
    const inviterId = code;
    if (!inviterId || inviterId === inviteeId) throw new Error('invalid_code');
    const existing = await this.referralModel.findOne({ inviteeId }).lean();
    if (existing) return { ok: true, already: true };
    await this.referralModel.create({
      inviteeId,
      inviterId,
      appliedAt: Date.now(),
    });
    return { ok: true };
  }

  // Mark that invitee enabled subscription
  async markSubscriptionEnabled(userId: string) {
    const ref = await this.referralModel.findOneAndUpdate(
      { inviteeId: userId },
      { $set: { subscriptionEnabled: true } },
      { new: true },
    );
    return { ok: true, hasReferral: !!ref };
  }

  // On first booking: award if subscription enabled and not rewarded yet
  async handleFirstBookingRewards(userId: string) {
    const ref = await this.referralModel.findOne({ inviteeId: userId }).lean();
    if (!ref || !ref.subscriptionEnabled || ref.rewardsGranted)
      return { ok: true };

    // invitee +200, inviter +300
    await this.loyaltyModel.updateOne(
      { userId },
      {
        $setOnInsert: { userId, points: 0, streakDays: 0 },
        $inc: { points: 200 },
      },
      { upsert: true },
    );
    await this.txModel.create({
      userId,
      type: 'earned',
      amount: 200,
      description: 'Referral bonus (invitee)',
      ts: Date.now(),
      icon: 'gift',
    });

    await this.loyaltyModel.updateOne(
      { userId: ref.inviterId },
      {
        $setOnInsert: { userId: ref.inviterId, points: 0, streakDays: 0 },
        $inc: { points: 300 },
      },
      { upsert: true },
    );
    await this.txModel.create({
      userId: ref.inviterId,
      type: 'earned',
      amount: 300,
      description: 'Referral bonus (inviter)',
      ts: Date.now(),
      icon: 'gift',
    });

    await this.referralModel.updateOne(
      { inviteeId: userId },
      { $set: { firstBookingAt: Date.now(), rewardsGranted: true } },
    );
    return { ok: true };
  }
}
