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
}
