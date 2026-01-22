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
import {
  DismantlerEngagement,
  DismantlerEngagementDocument,
} from '../schemas/dismantler-engagement.schema';
import {
  PartEngagement,
  PartEngagementDocument,
} from '../schemas/part-engagement.schema';
import { User } from '../schemas/user.schema';

@Injectable()
export class EngagementService {
  constructor(
    @InjectModel(StoreEngagement.name)
    private storeEngagementModel: Model<StoreEngagementDocument>,
    @InjectModel(MechanicEngagement.name)
    private mechanicEngagementModel: Model<MechanicEngagementDocument>,
    @InjectModel(DismantlerEngagement.name)
    private dismantlerEngagementModel: Model<DismantlerEngagementDocument>,
    @InjectModel(PartEngagement.name)
    private partEngagementModel: Model<PartEngagementDocument>,
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

  // Dismantler Engagement Methods

  async trackDismantlerAction(
    dismantlerId: string,
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
      const existing = await this.dismantlerEngagementModel
        .findOne({
          dismantlerId,
          userId,
          action,
        })
        .lean();

      if (existing) {
        // Update timestamp if exists
        await this.dismantlerEngagementModel.updateOne(
          { _id: existing._id },
          { timestamp: new Date() },
        );
        return existing;
      }
    }

    const engagement = new this.dismantlerEngagementModel({
      dismantlerId,
      userId,
      userName: userName || undefined,
      userPhone: user?.phone,
      userEmail: user?.email,
      action,
      timestamp: new Date(),
    });

    return engagement.save();
  }

  async getDismantlerStats(dismantlerId: string) {
    const [likesCount, viewsCount, callsCount] = await Promise.all([
      this.dismantlerEngagementModel.countDocuments({
        dismantlerId,
        action: 'like',
      }),
      this.dismantlerEngagementModel.countDocuments({
        dismantlerId,
        action: 'view',
      }),
      this.dismantlerEngagementModel.countDocuments({
        dismantlerId,
        action: 'call',
      }),
    ]);

    return {
      likesCount,
      viewsCount,
      callsCount,
    };
  }

  async toggleDismantlerLike(dismantlerId: string, userId: string) {
    const existing = await this.dismantlerEngagementModel
      .findOne({
        dismantlerId,
        userId,
        action: 'like',
      })
      .lean();

    if (existing) {
      // Unlike - remove the like
      await this.dismantlerEngagementModel.deleteOne({ _id: existing._id });
      const likesCount = await this.dismantlerEngagementModel.countDocuments({
        dismantlerId,
        action: 'like',
      });
      return { isLiked: false, likesCount };
    } else {
      // Like - add the like
      const user = await this.userModel.findOne({ id: userId }).lean();
      const userName = user?.firstName
        ? `${user.firstName} ${user.lastName || ''}`.trim()
        : undefined;

      await new this.dismantlerEngagementModel({
        dismantlerId,
        userId,
        userName: userName || undefined,
        userPhone: user?.phone,
        userEmail: user?.email,
        action: 'like',
        timestamp: new Date(),
      }).save();

      const likesCount = await this.dismantlerEngagementModel.countDocuments({
        dismantlerId,
        action: 'like',
      });
      return { isLiked: true, likesCount };
    }
  }

  async getDismantlersWithLikes(dismantlerIds: string[], userId?: string) {
    const likesMap = new Map<string, number>();
    const userLikesSet = new Set<string>();

    // Get likes count for all dismantlers
    const likesAggregation = await this.dismantlerEngagementModel.aggregate([
      {
        $match: {
          dismantlerId: { $in: dismantlerIds },
          action: 'like',
        },
      },
      {
        $group: {
          _id: '$dismantlerId',
          count: { $sum: 1 },
        },
      },
    ]);

    likesAggregation.forEach((item) => {
      likesMap.set(item._id, item.count);
    });

    // Get user's liked dismantlers if userId provided
    if (userId) {
      const userLikes = await this.dismantlerEngagementModel
        .find({
          userId,
          dismantlerId: { $in: dismantlerIds },
          action: 'like',
        })
        .select('dismantlerId')
        .lean();

      userLikes.forEach((engagement) => {
        userLikesSet.add(engagement.dismantlerId);
      });
    }

    // Return map of dismantlerId -> { likesCount, isLiked }
    const result: Record<string, { likesCount: number; isLiked: boolean }> =
      {};
    dismantlerIds.forEach((dismantlerId) => {
      result[dismantlerId] = {
        likesCount: likesMap.get(dismantlerId) || 0,
        isLiked: userLikesSet.has(dismantlerId),
      };
    });

    return result;
  }

  async getDismantlerEngagement(dismantlerId: string) {
    const [likes, views, calls] = await Promise.all([
      this.dismantlerEngagementModel
        .find({ dismantlerId, action: 'like' })
        .sort({ timestamp: -1 })
        .lean()
        .exec(),
      this.dismantlerEngagementModel
        .find({ dismantlerId, action: 'view' })
        .sort({ timestamp: -1 })
        .lean()
        .exec(),
      this.dismantlerEngagementModel
        .find({ dismantlerId, action: 'call' })
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

  // Part Engagement Methods

  async trackPartAction(
    partId: string,
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
      const existing = await this.partEngagementModel
        .findOne({
          partId,
          userId,
          action,
        })
        .lean();

      if (existing) {
        // Update timestamp if exists
        await this.partEngagementModel.updateOne(
          { _id: existing._id },
          { timestamp: new Date() },
        );
        return existing;
      }
    }

    const engagement = new this.partEngagementModel({
      partId,
      userId,
      userName: userName || undefined,
      userPhone: user?.phone,
      userEmail: user?.email,
      action,
      timestamp: new Date(),
    });

    return engagement.save();
  }

  async togglePartLike(partId: string, userId: string) {
    const existing = await this.partEngagementModel
      .findOne({
        partId,
        userId,
        action: 'like',
      })
      .lean();

    if (existing) {
      // Unlike - remove the like
      await this.partEngagementModel.deleteOne({ _id: existing._id });
      const likesCount = await this.partEngagementModel.countDocuments({
        partId,
        action: 'like',
      });
      return { isLiked: false, likesCount };
    } else {
      // Like - add the like
      const user = await this.userModel.findOne({ id: userId }).lean();
      const userName = user?.firstName
        ? `${user.firstName} ${user.lastName || ''}`.trim()
        : undefined;

      await new this.partEngagementModel({
        partId,
        userId,
        userName: userName || undefined,
        userPhone: user?.phone,
        userEmail: user?.email,
        action: 'like',
        timestamp: new Date(),
      }).save();

      const likesCount = await this.partEngagementModel.countDocuments({
        partId,
        action: 'like',
      });
      return { isLiked: true, likesCount };
    }
  }

  async getPartStats(partId: string) {
    const [likesCount, viewsCount, callsCount] = await Promise.all([
      this.partEngagementModel.countDocuments({
        partId,
        action: 'like',
      }),
      this.partEngagementModel.countDocuments({
        partId,
        action: 'view',
      }),
      this.partEngagementModel.countDocuments({
        partId,
        action: 'call',
      }),
    ]);

    return {
      likesCount,
      viewsCount,
      callsCount,
    };
  }

  async getUserLikedParts(userId: string): Promise<string[]> {
    const likedParts = await this.partEngagementModel
      .find({
        userId,
        action: 'like',
      })
      .select('partId')
      .lean();

    return likedParts.map((engagement) => engagement.partId);
  }

  async getPartsWithLikes(partIds: string[], userId?: string) {
    const likesMap = new Map<string, number>();
    const userLikesSet = new Set<string>();

    // Get likes count for all parts
    const likesAggregation = await this.partEngagementModel.aggregate([
      {
        $match: {
          partId: { $in: partIds },
          action: 'like',
        },
      },
      {
        $group: {
          _id: '$partId',
          count: { $sum: 1 },
        },
      },
    ]);

    likesAggregation.forEach((item) => {
      likesMap.set(item._id, item.count);
    });

    // Get user's liked parts if userId provided
    if (userId) {
      const userLikes = await this.partEngagementModel
        .find({
          userId,
          partId: { $in: partIds },
          action: 'like',
        })
        .select('partId')
        .lean();

      userLikes.forEach((engagement) => {
        userLikesSet.add(engagement.partId);
      });
    }

    // Return map of partId -> { likesCount, isLiked }
    const result: Record<string, { likesCount: number; isLiked: boolean }> =
      {};
    partIds.forEach((partId) => {
      result[partId] = {
        likesCount: likesMap.get(partId) || 0,
        isLiked: userLikesSet.has(partId),
      };
    });

    return result;
  }
}


