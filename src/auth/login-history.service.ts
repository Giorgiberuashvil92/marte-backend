import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LoginHistory,
  LoginHistoryDocument,
} from '../schemas/login-history.schema';

@Injectable()
export class LoginHistoryService {
  constructor(
    @InjectModel(LoginHistory.name)
    private loginHistoryModel: Model<LoginHistoryDocument>,
  ) {}

  async createLoginHistory(data: {
    userId: string;
    phone: string;
    email?: string;
    firstName?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: any;
    status?: 'success' | 'failed';
    failureReason?: string;
  }): Promise<LoginHistory> {
    const loginHistory = new this.loginHistoryModel({
      ...data,
      loginAt: new Date(),
      status: data.status || 'success',
    });
    return loginHistory.save();
  }

  async getUserLoginHistory(
    userId: string,
    limit: number = 50,
  ): Promise<LoginHistory[]> {
    return this.loginHistoryModel
      .find({ userId })
      .sort({ loginAt: -1 })
      .limit(limit)
      .exec();
  }

  async getAllLoginHistory(
    filters?: {
      userId?: string;
      phone?: string;
      startDate?: Date;
      endDate?: Date;
      status?: 'success' | 'failed';
    },
    limit: number = 100,
    skip: number = 0,
  ): Promise<{ data: LoginHistory[]; total: number }> {
    const query: any = {};

    if (filters?.userId) {
      query.userId = filters.userId;
    }
    if (filters?.phone) {
      query.phone = { $regex: filters.phone, $options: 'i' };
    }
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.startDate || filters?.endDate) {
      query.loginAt = {};
      if (filters.startDate) {
        query.loginAt.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.loginAt.$lte = filters.endDate;
      }
    }

    const [data, total] = await Promise.all([
      this.loginHistoryModel
        .find(query)
        .sort({ loginAt: -1 })
        .limit(limit)
        .skip(skip)
        .exec(),
      this.loginHistoryModel.countDocuments(query).exec(),
    ]);

    return { data, total };
  }

  async getLoginStats(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalLogins: number;
    uniqueUsers: number;
    successfulLogins: number;
    failedLogins: number;
    loginsToday: number;
    uniqueUsersToday: number;
    loginsPerUserToday: Array<{
      userId: string;
      phone: string;
      firstName?: string;
      count: number;
    }>;
  }> {
    const query: any = {};
    if (startDate || endDate) {
      query.loginAt = {};
      if (startDate) query.loginAt.$gte = startDate;
      if (endDate) query.loginAt.$lte = endDate;
    }

    // Today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayQuery = {
      ...query,
      loginAt: {
        $gte: todayStart,
        $lte: todayEnd,
      },
    };

    const [
      totalLogins,
      uniqueUsers,
      successfulLogins,
      failedLogins,
      loginsToday,
      uniqueUsersToday,
      loginsPerUserTodayData,
    ] = await Promise.all([
      this.loginHistoryModel.countDocuments(query).exec(),
      this.loginHistoryModel
        .distinct('userId', query)
        .exec()
        .then((r) => r.length),
      this.loginHistoryModel
        .countDocuments({ ...query, status: 'success' })
        .exec(),
      this.loginHistoryModel
        .countDocuments({ ...query, status: 'failed' })
        .exec(),
      this.loginHistoryModel.countDocuments(todayQuery).exec(),
      this.loginHistoryModel
        .distinct('userId', todayQuery)
        .exec()
        .then((r) => r.length),
      this.loginHistoryModel
        .aggregate([
          { $match: todayQuery },
          {
            $group: {
              _id: '$userId',
              count: { $sum: 1 },
              phone: { $first: '$phone' },
              firstName: { $first: '$firstName' },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ])
        .exec(),
    ]);

    const loginsPerUserToday = loginsPerUserTodayData.map((item: any) => ({
      userId: item._id,
      phone: item.phone,
      firstName: item.firstName,
      count: item.count,
    }));

    return {
      totalLogins,
      uniqueUsers,
      successfulLogins,
      failedLogins,
      loginsToday,
      uniqueUsersToday,
      loginsPerUserToday: loginsPerUserToday,
    };
  }

  /** ანალიტიკაში მხოლოდ 22 დეკემბერი 2025-ის შემდეგ შესვლები – ამ თარიღამდე ინფო არ ჩანს. */
  private static readonly ENGAGEMENT_ANALYTICS_PERIOD_START = new Date(
    '2025-12-22T00:00:00.000Z',
  );

  /**
   * ანალიტიკა: return users, ხშირად შემოსული (ბოლო 3 კვირა), დაკარგული (churned), ერთჯერადი.
   * მხოლოდ 22/12/2025-ის შემდეგ login_history.
   */
  /** ბოლო 21 დღეში მინიმუმ ამდენი განსხვავებული დღე უნდა ჰქონდეს შესვლა "თითქმის ყოველდღე" სეგმენტისთვის */
  private static readonly ALMOST_DAILY_MIN_DAYS = 3;

  async getEngagementAnalytics(): Promise<{
    summary: {
      totalUsers: number;
      returnUsers: number;
      activeLast3Weeks: number;
      churned: number;
      frequentLast3Weeks: number;
      oneTime: number;
      almostDaily: number;
      totalLoginsInPeriod: number;
    };
    segments: {
      returnUsers: EngagementUser[];
      churned: EngagementUser[];
      activeLast3Weeks: EngagementUser[];
      frequentLast3Weeks: EngagementUser[];
      oneTime: EngagementUser[];
      almostDaily: EngagementUser[];
    };
  }> {
    const now = new Date();
    const threeWeeksAgo = new Date(now);
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
    const periodStart = LoginHistoryService.ENGAGEMENT_ANALYTICS_PERIOD_START;

    const [raw, distinctDaysRaw] = await Promise.all([
      this.loginHistoryModel
      .aggregate([
        {
          $match: {
            status: 'success',
            loginAt: { $gte: periodStart },
          },
        },
        {
          $group: {
            _id: '$userId',
            loginCount: { $sum: 1 },
            countLast3Weeks: {
              $sum: {
                $cond: [{ $gte: ['$loginAt', threeWeeksAgo] }, 1, 0],
              },
            },
            firstLogin: { $min: '$loginAt' },
            lastLogin: { $max: '$loginAt' },
            phones: { $addToSet: '$phone' },
            emails: { $addToSet: '$email' },
            firstNames: { $addToSet: '$firstName' },
          },
        },
        {
          $project: {
            userId: '$_id',
            loginCount: 1,
            countLast3Weeks: 1,
            firstLogin: 1,
            lastLogin: 1,
            inactiveDays: {
              $divide: [
                { $subtract: [now, '$lastLogin'] },
                86400000,
              ],
            },
            phone: { $arrayElemAt: ['$phones', 0] },
            phones: 1,
            email: { $arrayElemAt: ['$emails', 0] },
            firstName: { $arrayElemAt: ['$firstNames', 0] },
          },
        },
        { $sort: { loginCount: -1 } },
      ])
      .exec(),
      this.loginHistoryModel
        .aggregate([
          {
            $match: {
              status: 'success',
              loginAt: { $gte: threeWeeksAgo },
            },
          },
          {
            $group: {
              _id: '$userId',
              daysSet: {
                $addToSet: {
                  $dateToString: { format: '%Y-%m-%d', date: '$loginAt' },
                },
              },
            },
          },
          {
            $project: {
              userId: '$_id',
              distinctDaysLast3Weeks: { $size: '$daysSet' },
            },
          },
        ])
        .exec(),
    ]);

    const distinctDaysByUserId = new Map<string, number>();
    for (const row of distinctDaysRaw as { userId: string; distinctDaysLast3Weeks: number }[]) {
      distinctDaysByUserId.set(row.userId, row.distinctDaysLast3Weeks);
    }

    const toUser = (r: any): EngagementUser => ({
      userId: r.userId,
      phone: r.phone || '',
      email: r.email,
      firstName: r.firstName,
      loginCount: r.loginCount,
      countLast3Weeks: r.countLast3Weeks || 0,
      firstLogin: r.firstLogin,
      lastLogin: r.lastLogin,
      inactiveDays: Math.round((r.inactiveDays || 0) * 10) / 10,
      distinctDaysLast3Weeks: distinctDaysByUserId.get(r.userId),
    });

    const isTestUser = (u: EngagementUser) =>
      /^test$/i.test((u.firstName || '').trim());

    // მხოლოდ 3-ზე მეტჯერ შემოსული: პირველი შესვლა 3-ჯერ ითვლის, ამიტომ რეალური ანალიტიკა loginCount > 3
    const users: EngagementUser[] = raw
      .map(toUser)
      .filter((u) => !isTestUser(u))
      .filter((u) => u.loginCount > 3);

    const returnUsers = users.filter((u) => u.loginCount >= 2);
    const activeLast3Weeks = users.filter((u) => u.inactiveDays <= 21);
    const churned = users.filter((u) => u.inactiveDays > 21);
    const frequentLast3Weeks = users.filter(
      (u) => u.inactiveDays <= 21 && u.countLast3Weeks >= 3,
    );
    const oneTime = users.filter((u) => u.loginCount === 1);
    const minDays = LoginHistoryService.ALMOST_DAILY_MIN_DAYS;
    const almostDaily = users
      .filter(
        (u) =>
          (u.distinctDaysLast3Weeks ?? 0) >= minDays && u.inactiveDays <= 21,
      )
      .sort(
        (a, b) =>
          (b.distinctDaysLast3Weeks ?? 0) - (a.distinctDaysLast3Weeks ?? 0),
      );

    const totalLoginsInPeriod = users.reduce((s, u) => s + u.loginCount, 0);

    return {
      summary: {
        totalUsers: users.length,
        returnUsers: returnUsers.length,
        activeLast3Weeks: activeLast3Weeks.length,
        churned: churned.length,
        frequentLast3Weeks: frequentLast3Weeks.length,
        oneTime: oneTime.length,
        almostDaily: almostDaily.length,
        totalLoginsInPeriod,
      },
      segments: {
        returnUsers,
        churned: churned.sort((a, b) => b.inactiveDays - a.inactiveDays),
        activeLast3Weeks,
        frequentLast3Weeks: frequentLast3Weeks.sort(
          (a, b) => b.countLast3Weeks - a.countLast3Weeks,
        ),
        oneTime,
        almostDaily,
      },
    };
  }
}

export interface EngagementUser {
  userId: string;
  phone: string;
  email?: string;
  firstName?: string;
  loginCount: number;
  countLast3Weeks: number;
  firstLogin: Date;
  lastLogin: Date;
  inactiveDays: number;
  /** ბოლო 21 დღეში განსხვავებული დღეების რაოდენობა, რომლებშიც იყო შესვლა */
  distinctDaysLast3Weeks?: number;
}
