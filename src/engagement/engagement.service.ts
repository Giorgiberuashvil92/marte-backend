import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  StoreEngagement,
  StoreEngagementDocument,
} from '../schemas/store-engagement.schema';
import {
  MechanicEngagement,
  MechanicEngagementDocument,
} from '../schemas/mechanic-engagement.schema';
import { User } from '../schemas/user.schema';

@Injectable()
export class EngagementService {
  constructor(
    @InjectModel(StoreEngagement.name)
    private storeEngagementModel: Model<StoreEngagementDocument>,
    @InjectModel(MechanicEngagement.name)
    private mechanicEngagementModel: Model<MechanicEngagementDocument>,
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) {}

  // Store Engagement Methods

  async trackStoreAction(
    storeId: string,
    userId: string,
    action: 'like' | 'view' | 'call',
    preventDuplicate = false,
  ) {
    // Get user info
    const user = await this.userModel.findOne({ id: userId }).lean();
    const userName = user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : undefined;

    // Check for duplicate if preventDuplicate is true
    if (preventDuplicate) {
      const existing = await this.storeEngagementModel
        .findOne({
          storeId,
          userId,
          action,
        })
        .lean();

      if (existing) {
        // Update timestamp if exists
        await this.storeEngagementModel.updateOne(
          { _id: existing._id },
          { timestamp: new Date() },
        );
        return existing;
      }
    }

    const engagement = new this.storeEngagementModel({
      storeId,
      userId,
      userName: userName || undefined,
      userPhone: user?.phone,
      userEmail: user?.email,
      action,
      timestamp: new Date(),
    });

    return engagement.save();
  }

  async getStoreStats(storeId: string) {
    const [likesCount, viewsCount, callsCount] = await Promise.all([
      this.storeEngagementModel.countDocuments({
        storeId,
        action: 'like',
      }),
      this.storeEngagementModel.countDocuments({
        storeId,
        action: 'view',
      }),
      this.storeEngagementModel.countDocuments({
        storeId,
        action: 'call',
      }),
    ]);

    return {
      likesCount,
      viewsCount,
      callsCount,
    };
  }

  async getStoreEngagement(storeId: string) {
    const [likes, views, calls] = await Promise.all([
      this.storeEngagementModel
        .find({ storeId, action: 'like' })
        .sort({ timestamp: -1 })
        .lean()
        .exec(),
      this.storeEngagementModel
        .find({ storeId, action: 'view' })
        .sort({ timestamp: -1 })
        .lean()
        .exec(),
      this.storeEngagementModel
        .find({ storeId, action: 'call' })
        .sort({ timestamp: -1 })
        .lean()
        .exec(),
    ]);

    return {
      likes: likes.map((item) => ({
        userId: item.userId,
        userName: item.userName,
        userPhone: item.userPhone,
        userEmail: item.userEmail,
        timestamp: item.timestamp,
      })),
      views: views.map((item) => ({
        userId: item.userId,
        userName: item.userName,
        userPhone: item.userPhone,
        userEmail: item.userEmail,
        timestamp: item.timestamp,
      })),
      calls: calls.map((item) => ({
        userId: item.userId,
        userName: item.userName,
        userPhone: item.userPhone,
        userEmail: item.userEmail,
        timestamp: item.timestamp,
      })),
    };
  }

  // Mechanic Engagement Methods

  async trackMechanicAction(
    mechanicId: string,
    userId: string,
    action: 'like' | 'view' | 'call',
    preventDuplicate = false,
  ) {
    // Get user info
    const user = await this.userModel.findOne({ id: userId }).lean();
    const userName = user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : undefined;

    // Check for duplicate if preventDuplicate is true
    if (preventDuplicate) {
      const existing = await this.mechanicEngagementModel
        .findOne({
          mechanicId,
          userId,
          action,
        })
        .lean();

      if (existing) {
        // Update timestamp if exists
        await this.mechanicEngagementModel.updateOne(
          { _id: existing._id },
          { timestamp: new Date() },
        );
        return existing;
      }
    }

    const engagement = new this.mechanicEngagementModel({
      mechanicId,
      userId,
      userName: userName || undefined,
      userPhone: user?.phone,
      userEmail: user?.email,
      action,
      timestamp: new Date(),
    });

    return engagement.save();
  }

  async getMechanicStats(mechanicId: string) {
    const [likesCount, viewsCount, callsCount] = await Promise.all([
      this.mechanicEngagementModel.countDocuments({
        mechanicId,
        action: 'like',
      }),
      this.mechanicEngagementModel.countDocuments({
        mechanicId,
        action: 'view',
      }),
      this.mechanicEngagementModel.countDocuments({
        mechanicId,
        action: 'call',
      }),
    ]);

    return {
      likesCount,
      viewsCount,
      callsCount,
    };
  }

  async getMechanicEngagement(mechanicId: string) {
    const [likes, views, calls] = await Promise.all([
      this.mechanicEngagementModel
        .find({ mechanicId, action: 'like' })
        .sort({ timestamp: -1 })
        .lean()
        .exec(),
      this.mechanicEngagementModel
        .find({ mechanicId, action: 'view' })
        .sort({ timestamp: -1 })
        .lean()
        .exec(),
      this.mechanicEngagementModel
        .find({ mechanicId, action: 'call' })
        .sort({ timestamp: -1 })
        .lean()
        .exec(),
    ]);

    return {
      likes: likes.map((item) => ({
        userId: item.userId,
        userName: item.userName,
        userPhone: item.userPhone,
        userEmail: item.userEmail,
        timestamp: item.timestamp,
      })),
      views: views.map((item) => ({
        userId: item.userId,
        userName: item.userName,
        userPhone: item.userPhone,
        userEmail: item.userEmail,
        timestamp: item.timestamp,
      })),
      calls: calls.map((item) => ({
        userId: item.userId,
        userName: item.userName,
        userPhone: item.userPhone,
        userEmail: item.userEmail,
        timestamp: item.timestamp,
      })),
    };
  }
}


