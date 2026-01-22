import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AnalyticsEvent,
  AnalyticsEventDocument,
} from '../schemas/analytics-event.schema';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(AnalyticsEvent.name)
    private analyticsModel: Model<AnalyticsEventDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  async trackEvent(
    eventType: string,
    eventName: string,
    userId?: string,
    screen?: string,
    params?: Record<string, any>,
  ) {
    const event = new this.analyticsModel({
      eventType,
      eventName,
      userId,
      screen,
      params,
      timestamp: Date.now(),
    });

    return event.save();
  }

  async getScreenViews(period: 'today' | 'week' | 'month') {
    const dateRange = this.getDateRange(period);

    const screenViews = await this.analyticsModel.aggregate([
      {
        $match: {
          eventType: 'screen_view',
          timestamp: { $gte: dateRange.start, $lte: dateRange.end },
        },
      },
      {
        $group: {
          _id: '$eventName',
          views: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          screenName: '$_id',
          views: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
        },
      },
      {
        $sort: { views: -1 },
      },
    ]);

    return screenViews.map((item) => ({
      screenName: item.screenName,
      views: item.views,
      uniqueUsers: item.uniqueUsers,
    }));
  }

  async getButtonClicks(period: 'today' | 'week' | 'month') {
    const dateRange = this.getDateRange(period);

    const buttonClicks = await this.analyticsModel.aggregate([
      {
        $match: {
          eventType: 'button_click',
          timestamp: { $gte: dateRange.start, $lte: dateRange.end },
        },
      },
      {
        $group: {
          _id: {
            buttonName: '$eventName',
            screen: '$screen',
          },
          clicks: { $sum: 1 },
        },
      },
      {
        $project: {
          buttonName: '$_id.buttonName',
          screen: '$_id.screen',
          clicks: 1,
        },
      },
      {
        $sort: { clicks: -1 },
      },
      { $limit: 20 },
    ]);

    return buttonClicks.map((item) => ({
      buttonName: item.buttonName,
      screen: item.screen || 'უცნობი',
      clicks: item.clicks,
    }));
  }

  async getUserEngagement(period: 'today' | 'week' | 'month') {
    const dateRange = this.getDateRange(period);

    const [activeUsers, totalSessions, newUsers] = await Promise.all([
      // Active users (unique users with any event)
      this.analyticsModel.distinct('userId', {
        timestamp: { $gte: dateRange.start, $lte: dateRange.end },
        userId: { $exists: true, $ne: null },
      }),

      // Total sessions (screen views count as sessions)
      this.analyticsModel.countDocuments({
        eventType: 'screen_view',
        timestamp: { $gte: dateRange.start, $lte: dateRange.end },
      }),

      // New users (first event in this period)
      this.analyticsModel
        .distinct('userId', {
          timestamp: { $gte: dateRange.start, $lte: dateRange.end },
          userId: { $exists: true, $ne: null },
        })
        .then(async (userIds) => {
          // Check if these users had events before this period
          const existingUsers = await this.analyticsModel.distinct('userId', {
            timestamp: { $lt: dateRange.start },
            userId: { $in: userIds },
          });
          return userIds.filter((id) => !existingUsers.includes(id)).length;
        }),
    ]);

    // Calculate average session duration (simplified - based on time between first and last screen view per user)
    const sessionDurations = await this.analyticsModel.aggregate([
      {
        $match: {
          eventType: 'screen_view',
          timestamp: { $gte: dateRange.start, $lte: dateRange.end },
          userId: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$userId',
          firstView: { $min: '$timestamp' },
          lastView: { $max: '$timestamp' },
        },
      },
      {
        $project: {
          duration: { $subtract: ['$lastView', '$firstView'] },
        },
      },
    ]);

    const averageSessionDuration =
      sessionDurations.length > 0
        ? sessionDurations.reduce((sum, s) => sum + (s.duration || 0), 0) /
          sessionDurations.length /
          60000 // Convert to minutes
        : 0;

    return {
      activeUsers: activeUsers.length,
      totalSessions,
      averageSessionDuration: Math.round(averageSessionDuration * 10) / 10,
      newUsers,
    };
  }

  async getNavigationFlows(period: 'today' | 'week' | 'month') {
    const dateRange = this.getDateRange(period);

    // Get navigation events
    const navigations = await this.analyticsModel
      .find({
        eventType: 'navigation',
        timestamp: { $gte: dateRange.start, $lte: dateRange.end },
      })
      .lean();

    // Group by from->to
    const flowMap = new Map<string, number>();
    navigations.forEach((nav) => {
      const from = nav.params?.from_screen || 'უცნობი';
      const to = nav.params?.to_screen || 'უცნობი';
      const key = `${from}->${to}`;
      flowMap.set(key, (flowMap.get(key) || 0) + 1);
    });

    return Array.from(flowMap.entries())
      .map(([key, count]) => {
        const [from, to] = key.split('->');
        return { from, to, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  async getPopularFeatures(period: 'today' | 'week' | 'month') {
    const dateRange = this.getDateRange(period);
    const previousDateRange = this.getPreviousPeriodDateRange(period);

    // Get button clicks and screen views grouped by feature name
    const [currentPeriod, previousPeriod] = await Promise.all([
      this.analyticsModel.aggregate([
        {
          $match: {
            $or: [{ eventType: 'button_click' }, { eventType: 'screen_view' }],
            timestamp: { $gte: dateRange.start, $lte: dateRange.end },
          },
        },
        {
          $group: {
            _id: '$eventName',
            usage: { $sum: 1 },
          },
        },
        {
          $sort: { usage: -1 },
        },
        { $limit: 10 },
      ]),
      this.analyticsModel.aggregate([
        {
          $match: {
            $or: [{ eventType: 'button_click' }, { eventType: 'screen_view' }],
            timestamp: {
              $gte: previousDateRange.start,
              $lte: previousDateRange.end,
            },
          },
        },
        {
          $group: {
            _id: '$eventName',
            usage: { $sum: 1 },
          },
        },
      ]),
    ]);

    const previousMap = new Map(
      previousPeriod.map((item) => [item._id, item.usage]),
    );

    return currentPeriod.map((item) => {
      const previousUsage = previousMap.get(item._id) || 0;
      const trend =
        previousUsage > 0
          ? ((item.usage - previousUsage) / previousUsage) * 100
          : item.usage > 0
            ? 100
            : 0;

      return {
        name: item._id,
        usage: item.usage,
        trend: `${trend >= 0 ? '+' : ''}${Math.round(trend)}%`,
      };
    });
  }

  private getDateRange(period: 'today' | 'week' | 'month') {
    const now = Date.now();
    let start: number;

    switch (period) {
      case 'today':
        start = new Date().setHours(0, 0, 0, 0);
        break;
      case 'week':
        start = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case 'month':
        const date = new Date();
        start = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
        break;
      default:
        start = now - 7 * 24 * 60 * 60 * 1000;
    }

    return { start, end: now };
  }

  async getUserEvents(
    userId: string,
    period: 'today' | 'week' | 'month' = 'week',
    limit: number = 100,
  ) {
    const dateRange = this.getDateRange(period);
    
    const events = await this.analyticsModel
      .find({
        userId: userId,
        timestamp: { $gte: dateRange.start, $lte: dateRange.end },
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    // Get user info
    const user = await this.userModel.findOne({ id: userId }).lean();

    return {
      userId,
      userInfo: user
        ? {
            phone: user.phone || 'უცნობი',
            firstName: user.firstName || 'უცნობი',
            lastName: user.lastName || 'უცნობი',
            email: user.email || null,
            role: user.role || 'customer',
            isVerified: user.isVerified || false,
            createdAt: user.createdAt || null,
          }
        : null,
      events: events.map((event) => ({
        id: event._id.toString(),
        eventType: event.eventType,
        eventName: event.eventName,
        screen: event.screen || 'უცნობი',
        params: event.params || {},
        paramsFormatted: event.params
          ? JSON.stringify(event.params, null, 2)
          : null,
        timestamp: event.timestamp,
        date: new Date(event.timestamp).toISOString(),
        dateFormatted: new Date(event.timestamp).toLocaleString('ka-GE', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      })),
      totalEvents: events.length,
      firstEvent: events.length > 0
        ? new Date(events[events.length - 1].timestamp).toISOString()
        : null,
      lastEvent: events.length > 0
        ? new Date(events[0].timestamp).toISOString()
        : null,
    };
  }

  async getAllUsersEvents(
    period: 'today' | 'week' | 'month' = 'week',
    limit: number = 500,
  ) {
    const dateRange = this.getDateRange(period);
    
    const events = await this.analyticsModel
      .find({
        timestamp: { $gte: dateRange.start, $lte: dateRange.end },
        userId: { $exists: true, $ne: null },
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    // Get unique user IDs
    const userIds = Array.from(
      new Set(events.map((e) => e.userId).filter(Boolean)),
    );

    // Fetch user info for all users
    const users = await this.userModel
      .find({ id: { $in: userIds } })
      .lean();
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    // Group by user
    const userEventsMap = new Map<string, any[]>();
    
    events.forEach((event) => {
      const userId = event.userId || 'უცნობი';
      if (!userEventsMap.has(userId)) {
        userEventsMap.set(userId, []);
      }
      userEventsMap.get(userId)!.push({
        id: event._id.toString(),
        eventType: event.eventType,
        eventName: event.eventName,
        screen: event.screen || 'უცნობი',
        params: event.params || {},
        paramsFormatted: event.params
          ? JSON.stringify(event.params, null, 2)
          : null,
        timestamp: event.timestamp,
        date: new Date(event.timestamp).toISOString(),
        dateFormatted: new Date(event.timestamp).toLocaleString('ka-GE', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });
    });

    // Convert to array format with user info
    return Array.from(userEventsMap.entries()).map(([userId, events]) => {
      const user = userMap.get(userId);
      return {
        userId,
        userInfo: user
          ? {
              phone: user.phone || 'უცნობი',
              firstName: user.firstName || 'უცნობი',
              lastName: user.lastName || 'უცნობი',
              email: user.email || null,
              role: user.role || 'customer',
              isVerified: user.isVerified || false,
            }
          : null,
        eventsCount: events.length,
        events: events.slice(0, 50), // Limit events per user
        lastActivity: events[0]?.timestamp || 0,
        lastActivityFormatted: events[0]
          ? new Date(events[0].timestamp).toLocaleString('ka-GE', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          : null,
      };
    });
  }

  private getPreviousPeriodDateRange(period: 'today' | 'week' | 'month') {
    const now = Date.now();
    let start: number;
    let end: number;

    switch (period) {
      case 'today': {
        // Previous day
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        start = new Date(yesterday.setHours(0, 0, 0, 0)).getTime();
        end = new Date(yesterday.setHours(23, 59, 59, 999)).getTime();
        break;
      }
      case 'week':
        // Previous week
        start = now - 14 * 24 * 60 * 60 * 1000;
        end = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case 'month': {
        // Previous month
        const date = new Date();
        start = new Date(date.getFullYear(), date.getMonth() - 1, 1).getTime();
        end = new Date(
          date.getFullYear(),
          date.getMonth(),
          0,
          23,
          59,
          59,
          999,
        ).getTime();
        break;
      }
      default:
        start = now - 14 * 24 * 60 * 60 * 1000;
        end = now - 7 * 24 * 60 * 60 * 1000;
    }

    return { start, end };
  }
}
