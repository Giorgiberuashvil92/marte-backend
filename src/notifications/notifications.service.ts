import { Injectable } from '@nestjs/common';
import twilio, { Twilio } from 'twilio';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Store, StoreDocument } from '../schemas/store.schema';
import { Dismantler, DismantlerDocument } from '../schemas/dismantler.schema';
import { DeviceToken, DeviceTokenDocument } from './device-token.schema';
import {
  Notification,
  NotificationDocument,
} from '../schemas/notification.schema';
import { User, UserDocument } from '../schemas/user.schema';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
}

export interface NotificationTarget {
  userId?: string;
  partnerId?: string;
  storeId?: string;
  dismantlerId?: string;
  role?: 'user' | 'partner' | 'store' | 'dismantler';
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(Store.name)
    private storeModel: Model<StoreDocument>,
    @InjectModel(Dismantler.name)
    private dismantlerModel: Model<DismantlerDocument>,
    @InjectModel(DeviceToken.name)
    private deviceTokenModel: Model<DeviceTokenDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  private getTwilioClient(): Twilio | null {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) return null;
    return twilio(accountSid, authToken);
  }

  async sendSms(params: {
    to: string;
    body: string;
    from?: string;
  }): Promise<{ ok: boolean; sid?: string; error?: string }> {
    const client = this.getTwilioClient();
    if (!client) {
      return { ok: false, error: 'Twilio not configured' };
    }

    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = params.from || process.env.TWILIO_FROM;

    try {
      const message = await client.messages.create({
        to: params.to,
        body: params.body,
        ...(messagingServiceSid
          ? { messagingServiceSid }
          : fromNumber
            ? { from: fromNumber }
            : {}),
      });
      return { ok: true, sid: message.sid };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      return { ok: false, error: errMsg };
    }
  }

  /**
   * Converts ownerId to user.id (userId for device tokens)
   */
  private async getUserIdFromOwnerId(ownerId: string): Promise<string | null> {
    if (!ownerId) {
      console.log('⚠️ [getUserIdFromOwnerId] ownerId is empty');
      return null;
    }

    console.log(
      `🔍 [getUserIdFromOwnerId] Looking up userId for ownerId: ${ownerId} (type: ${typeof ownerId})`,
    );

    // If ownerId already looks like a userId (starts with "usr_"), use it directly
    // Even if user doesn't exist in DB, we can still use it for notifications
    if (ownerId.startsWith('usr_')) {
      try {
        const user = await this.userModel.findOne({ id: ownerId }).lean();
        if (user?.id) {
          console.log(
            `✅ [getUserIdFromOwnerId] ownerId is already userId (verified): ${ownerId}`,
          );
          return String(user.id);
        } else {
          // User not found in DB, but ownerId looks like userId, use it anyway
          console.log(
            `⚠️ [getUserIdFromOwnerId] ownerId looks like userId but user not found in DB, using it anyway: ${ownerId}`,
          );
          return ownerId;
        }
      } catch (error) {
        console.log(
          `⚠️ [getUserIdFromOwnerId] Error verifying userId ${ownerId}, using it anyway:`,
          error,
        );
        // On error, still return ownerId if it looks like userId
        return ownerId;
      }
    }

    // Try to find user by _id (ObjectId) if ownerId is a valid ObjectId
    if (Types.ObjectId.isValid(ownerId)) {
      try {
        const user = await this.userModel.findById(ownerId).lean();
        if (user?.id) {
          console.log(
            `✅ [getUserIdFromOwnerId] Found user by _id: ${ownerId} -> ${user.id}`,
          );
          return String(user.id);
        } else {
          console.log(
            `⚠️ [getUserIdFromOwnerId] User found by _id but no id field: ${ownerId}`,
          );
        }
      } catch (error) {
        console.log(
          `⚠️ [getUserIdFromOwnerId] Error finding user by _id ${ownerId}:`,
          error,
        );
        // Continue to try by id field
      }
    }

    // Try to find by id field (string like "usr_1759840730669")
    try {
      const user = await this.userModel.findOne({ id: ownerId }).lean();
      if (user?.id) {
        console.log(
          `✅ [getUserIdFromOwnerId] Found user by id field: ${ownerId} -> ${user.id}`,
        );
        return String(user.id);
      } else {
        console.log(
          `⚠️ [getUserIdFromOwnerId] User not found by id field: ${ownerId}`,
        );
      }
    } catch (error) {
      console.log(
        `⚠️ [getUserIdFromOwnerId] Error finding user by id field ${ownerId}:`,
        error,
      );
    }

    console.log(
      `❌ [getUserIdFromOwnerId] Could not find userId for ownerId: ${ownerId}`,
    );
    return null;
  }

  /**
   * Get device tokens for user IDs
   */
  private async getTokensForUserIds(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];

    const docs = await this.deviceTokenModel
      .find({ userId: { $in: userIds } })
      .select({ token: 1 })
      .lean();

    return docs.map((d) => d.token).filter((t): t is string => !!t);
  }

  /**
   * Send FCM push notification
   */
  private async sendFcm(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<void> {
    if (!tokens || tokens.length === 0) {
      return;
    }

    // Lazy-init Firebase Admin SDK
    const fa = await import('firebase-admin');
    const admin: any = (fa as any).default ?? fa;

    if (!admin.apps || !admin.apps.length) {
      try {
        try {
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
          });
        } catch {
          const fs = await import('fs');
          const path =
            process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
            './firebase-adminsdk.json';
          const json = JSON.parse(fs.readFileSync(path, 'utf8'));
          admin.initializeApp({
            credential: admin.credential.cert(json),
          });
        }
      } catch (e) {
        console.error('❌ Firebase init failed:', e);
        return;
      }
    }

    const messaging = admin.messaging();

    // Send multicast message (up to 500 tokens per request)
    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      android: {
        notification: {
          sound: payload.sound || 'default',
          channelId: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: payload.sound || 'default',
            badge: payload.badge || 1,
          },
        },
      },
      tokens: tokens.slice(0, 500),
    };

    try {
      const response = await messaging.sendMulticast(message);

      // Remove invalid tokens
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
          }
        });

        if (failedTokens.length > 0) {
          await this.deviceTokenModel.deleteMany({
            token: { $in: failedTokens },
          });
        }
      }

      // Send remaining tokens if more than 500
      if (tokens.length > 500) {
        await this.sendFcm(tokens.slice(500), payload);
      }
    } catch (error: any) {
      console.error('❌ FCM sendMulticast error:', error);

      // Fallback: try per-token send if batch fails (e.g., /batch endpoint 404)
      const errMsg =
        error?.errorInfo?.message || error?.message || String(error);
      if (
        errMsg.includes('/batch') ||
        errMsg.includes('404') ||
        errMsg.includes('unknown-error')
      ) {
        console.log(
          '⚠️ Falling back to per-token send for',
          tokens.length,
          'tokens',
        );

        let successCount = 0;
        let failureCount = 0;
        const invalidTokens: string[] = [];

        for (const token of tokens) {
          try {
            await messaging.send({
              notification: message.notification,
              data: message.data,
              android: message.android,
              apns: message.apns,
              token,
            });
            successCount++;
          } catch (e: any) {
            failureCount++;
            const code = e?.errorInfo?.code || e?.code;
            const msg = e?.errorInfo?.message || e?.message || '';

            // Mark invalid tokens for deletion
            if (
              code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-registration-token' ||
              msg.toLowerCase().includes('not registered')
            ) {
              invalidTokens.push(token);
            }
          }
        }

        // Cleanup invalid tokens
        if (invalidTokens.length > 0) {
          await this.deviceTokenModel.deleteMany({
            token: { $in: invalidTokens },
          });
          console.log(`🗑️ Removed ${invalidTokens.length} invalid tokens`);
        }

        console.log(
          `✅ FCM fallback: ${successCount} sent, ${failureCount} failed`,
        );
      } else {
        // Other errors - just log
        console.error('❌ FCM error (not batch-related):', errMsg);
      }
    }
  }

  /**
   * Send push notification to specific users
   * IMPORTANT: Always saves notification with userId (not role)
   */
  async sendPushToUsers(
    userIds: string[],
    payload: PushNotificationPayload,
    type: 'request' | 'offer' | 'message' | 'system' = 'system',
  ): Promise<void> {
    if (userIds.length === 0) return;

    // Save notifications to database (one per user)
    const notifications = userIds.map((userId) => ({
      target: { userId },
      payload,
      type,
      status: 'pending' as const,
      createdAt: Date.now(),
    }));

    await this.notificationModel.insertMany(notifications);

    // Get device tokens and send FCM
    const tokens = await this.getTokensForUserIds(userIds);
    if (tokens.length > 0) {
      await this.sendFcm(tokens, payload);

      // Update status to delivered
      await this.notificationModel.updateMany(
        { 'target.userId': { $in: userIds }, status: 'pending' },
        { status: 'delivered', deliveredAt: Date.now() },
      );
    }
  }

  /**
   * Get user IDs by filter (role, active)
   */
  async getUserIdsByFilter(filter: {
    role?: string;
    active?: boolean;
  }): Promise<string[]> {
    const query: any = {};
    if (filter.role) {
      query.role = filter.role;
    }
    if (typeof filter.active === 'boolean') {
      query.isActive = filter.active;
    }

    const users = await this.userModel.find(query).select('id').lean();
    return users.map((u: any) => String(u.id || '')).filter(Boolean);
  }

  /**
   * Broadcast notification to all users
   * Saves notification with role: 'user' so all users can see it
   */
  async broadcastToAllUsers(payload: PushNotificationPayload): Promise<{
    success: boolean;
    sent: number;
    failed: number;
  }> {
    // Get all device tokens
    const allTokens = await this.deviceTokenModel
      .find({})
      .select({ token: 1 })
      .lean();
    const tokens = allTokens
      .map((t) => t.token)
      .filter((t): t is string => !!t);

    if (tokens.length === 0) {
      return { success: false, sent: 0, failed: 0 };
    }

    try {
      await this.notificationModel.create({
        target: { role: 'user' },
        payload,
        type: 'system',
        status: 'pending',
        createdAt: Date.now(),
      });
    } catch (error) {
      console.error('⚠️ Failed to save broadcast notification:', error);
    }

    try {
      await this.sendFcm(tokens, payload);
      return { success: true, sent: tokens.length, failed: 0 };
    } catch (error) {
      console.error('❌ Broadcast error:', error);
      return { success: false, sent: 0, failed: tokens.length };
    }
  }

  /**
   * Send request notification to relevant stores/dismantlers
   */
  async sendRequestNotificationToRelevantStores(requestData: {
    partName: string;
    vehicle: {
      make: string;
      model: string;
      year?: string;
      submodel?: string;
    };
    location?: string;
    userId: string;
    requestId?: string;
  }): Promise<void> {
    const vehicleInfo =
      `${requestData.vehicle.make || ''} ${requestData.vehicle.model || ''}${requestData.vehicle.year ? ' ' + requestData.vehicle.year : ''}`.trim();
    const payload: PushNotificationPayload = {
      title: 'MARTE - მართე',
      body: `${vehicleInfo} - ${requestData.partName} ნაწილის მოთხოვნა • ამ ნაწილზე გაქვთ შეთავაზება`,
      data: {
        type: 'new_request',
        requestData: JSON.stringify(requestData),
        screen: 'RequestDetails',
        requestId: requestData.requestId || '',
        partnerType: 'store',
      },
    };

    const make = (requestData.vehicle.make || '').toLowerCase();
    const model = (requestData.vehicle.model || '').toLowerCase();
    const year = (requestData.vehicle.year || '').toString();

    // Find matching stores
    const storeQuery: Record<string, unknown>[] = [
      { type: { $in: ['ავტონაწილები', 'სამართ-დასახურებელი'] } },
    ];

    const storeSpecializations: Record<string, unknown>[] = [];
    if (make) {
      storeSpecializations.push({
        specializations: { $elemMatch: { $regex: make, $options: 'i' } },
      });
    }
    if (model) {
      storeSpecializations.push({
        specializations: { $elemMatch: { $regex: model, $options: 'i' } },
      });
    }
    if (year) {
      storeSpecializations.push({
        specializations: { $elemMatch: { $regex: year, $options: 'i' } },
      });
    }

    if (storeSpecializations.length > 0) {
      storeQuery.push({ $or: storeSpecializations });
    }

    // დავამატოთ status: 'active' ფილტრი
    const baseStoreQuery =
      storeSpecializations.length > 0
        ? { $and: storeQuery }
        : { type: { $in: ['ავტონაწილები', 'სამართ-დასახურებელი'] } };

    const finalStoreQuery = {
      ...baseStoreQuery,
      status: 'active', // მხოლოდ active მაღაზიები
    };

    const stores = await this.storeModel
      .find(finalStoreQuery)
      .select({ _id: 1, ownerId: 1 })
      .lean();

    /**
     * Helper function to normalize brand/model strings for matching
     */
    const normalizeForMatching = (str: string): string => {
      return (str || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ') // Multiple spaces to single space
        .replace(/[-_]/g, ' ') // Dashes and underscores to spaces
        .trim();
    };

    /**
     * Helper function to create flexible RegExp for brand/model matching
     */
    const createFlexibleRegex = (text: string): RegExp | null => {
      if (!text || !text.trim()) return null;
      const normalized = normalizeForMatching(text);
      // Escape special regex characters but allow flexible matching
      const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Allow optional spaces and dashes
      const flexible = escaped.replace(/\s+/g, '[\\s\\-]*');
      return new RegExp(`^${flexible}$`, 'i');
    };

    // Find matching dismantlers
    // Use same query logic as AI recommendations (include pending status)
    const dismantlerQuery: Record<string, any> = {
      $or: [
        { status: 'pending' },
        { status: 'approved' },
        { status: 'active' },
        { status: { $exists: false } },
      ],
    };

    // Use flexible matching for brand
    if (make && make.trim()) {
      const brandRegex = createFlexibleRegex(make);
      if (brandRegex) {
        dismantlerQuery.brand = brandRegex;
      }
    }

    // Use flexible matching for model
    if (model && model.trim()) {
      const modelRegex = createFlexibleRegex(model);
      if (modelRegex) {
        dismantlerQuery.model = modelRegex;
      }
    }
    if (year) {
      const yearNum = Number(year);
      if (!Number.isNaN(yearNum)) {
        dismantlerQuery.$and = [
          { yearFrom: { $lte: yearNum } },
          { yearTo: { $gte: yearNum } },
        ];
      }
    }

    console.log(
      '🔍 [NOTIFICATIONS] Dismantler query for request notifications:',
      JSON.stringify(
        {
          ...dismantlerQuery,
          brand: dismantlerQuery.brand
            ? `RegExp(${dismantlerQuery.brand.source}, ${dismantlerQuery.brand.flags})`
            : undefined,
          model: dismantlerQuery.model
            ? `RegExp(${dismantlerQuery.model.source}, ${dismantlerQuery.model.flags})`
            : undefined,
        },
        null,
        2,
      ),
    );

    const dismantlers = await this.dismantlerModel
      .find(dismantlerQuery)
      .select({ _id: 1, ownerId: 1, brand: 1, model: 1, name: 1 })
      .lean();

    console.log(
      `🔍 [NOTIFICATIONS] Found ${dismantlers.length} dismantlers for request notifications`,
    );

    // Debug: Log dismantler details
    if (dismantlers.length > 0) {
      console.log(
        `🔍 [NOTIFICATIONS] Dismantler details:`,
        dismantlers.map((d: any) => ({
          name: d.name,
          brand: d.brand,
          model: d.model,
          ownerId: d.ownerId,
          ownerIdType: typeof d.ownerId,
        })),
      );
    }

    // Convert ownerIds to userIds
    const userIds = new Set<string>();

    console.log(
      `🔍 [NOTIFICATIONS] Processing ${stores.length} stores and ${dismantlers.length} dismantlers`,
    );

    for (const store of stores) {
      const ownerId = (store as { ownerId?: string }).ownerId;
      if (ownerId) {
        const userId = await this.getUserIdFromOwnerId(String(ownerId));
        if (userId) {
          userIds.add(userId);
          console.log(
            `✅ [NOTIFICATIONS] Store ownerId ${ownerId} -> userId ${userId}`,
          );
        } else {
          console.log(
            `⚠️ [NOTIFICATIONS] Could not convert store ownerId ${ownerId} to userId`,
          );
        }
      }
    }

    for (const dismantler of dismantlers) {
      const ownerId = (dismantler as { ownerId?: string }).ownerId;
      const dismantlerName = (dismantler as { name?: string }).name;
      if (ownerId) {
        const userId = await this.getUserIdFromOwnerId(String(ownerId));
        if (userId) {
          userIds.add(userId);
          console.log(
            `✅ [NOTIFICATIONS] Dismantler "${dismantlerName}" ownerId ${ownerId} -> userId ${userId}`,
          );
        } else {
          console.log(
            `⚠️ [NOTIFICATIONS] Could not convert dismantler "${dismantlerName}" ownerId ${ownerId} to userId`,
          );
        }
      } else {
        console.log(
          `⚠️ [NOTIFICATIONS] Dismantler "${dismantlerName}" has no ownerId`,
        );
      }
    }

    // Send notifications to all matched users
    if (userIds.size > 0) {
      console.log(
        `📤 [NOTIFICATIONS] Sending request notifications to ${userIds.size} users:`,
        Array.from(userIds),
      );
      await this.sendPushToUsers(Array.from(userIds), payload, 'request');
    } else {
      console.log(
        '⚠️ [NOTIFICATIONS] No userIds found for stores/dismantlers - no notifications sent',
      );
    }
  }

  /**
   * Send offer notification to user
   */
  async sendOfferNotificationToUser(
    userId: string,
    offerData: {
      storeName: string;
      price: number;
      partName: string;
      offerId?: string;
    },
  ): Promise<void> {
    const payload: PushNotificationPayload = {
      title: 'ახალი შეთავაზება',
      body: `${offerData.storeName} - ${offerData.partName} (${offerData.price}₾)`,
      data: {
        type: 'new_offer',
        offerData: JSON.stringify(offerData),
        screen: 'OfferDetails',
        offerId: offerData.offerId || '',
      },
    };

    await this.sendPushToUsers([userId], payload, 'offer');
  }

  /**
   * Send message notification
   */
  async sendMessageNotification(
    targetUserId: string,
    messageData: {
      fromName: string;
      message: string;
      offerId: string;
    },
  ): Promise<void> {
    const payload: PushNotificationPayload = {
      title: `ახალი მესიჯი ${messageData.fromName}-სგან`,
      body: messageData.message,
      data: {
        type: 'chat_message',
        offerId: messageData.offerId,
      },
    };

    await this.sendPushToUsers([targetUserId], payload, 'message');
  }

  /**
   * Get user notifications
   * Returns notifications where:
   * - target.userId === userId (specific user notifications)
   * - target.role === 'user' (broadcast notifications for all users)
   */
  async getUserNotifications(
    userId: string,
    limit = 50,
  ): Promise<Notification[]> {
    const query = {
      $or: [{ 'target.userId': userId }, { 'target.role': 'user' }],
    };

    return this.notificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get partner notifications
   */
  async getPartnerNotifications(
    partnerId: string,
    limit = 50,
  ): Promise<Notification[]> {
    return this.notificationModel
      .find({
        $or: [{ 'target.partnerId': partnerId }, { 'target.role': 'partner' }],
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Mark notification as delivered
   */
  async markAsDelivered(notificationId: string): Promise<void> {
    await this.notificationModel.findByIdAndUpdate(notificationId, {
      status: 'delivered',
      deliveredAt: Date.now(),
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await this.notificationModel.findByIdAndUpdate(notificationId, {
      status: 'read',
      readAt: Date.now(),
    });
  }

  /**
   * Register device token
   */
  async registerDevice(dto: {
    userId: string;
    token: string;
    platform?: string;
    deviceInfo?: {
      deviceName?: string | null;
      modelName?: string | null;
      brand?: string | null;
      manufacturer?: string | null;
      osName?: string | null;
      osVersion?: string | null;
      deviceType?: string | null;
      totalMemory?: number | null;
      appVersion?: string | null;
      appBuildNumber?: string | null;
      platform?: string | null;
      platformVersion?: string | null;
    };
  }) {
    const updateData: any = {
      userId: dto.userId,
      platform: dto.platform || 'unknown',
    };

    if (dto.deviceInfo) {
      updateData.deviceInfo = dto.deviceInfo;
    }

    await this.deviceTokenModel.updateOne(
      { token: dto.token },
      { $set: updateData },
      { upsert: true },
    );

    return { ok: true };
  }

  /**
   * Get device tokens
   */
  async getDeviceTokens(userId?: string): Promise<DeviceTokenDocument[]> {
    const query = userId ? { userId } : {};
    return this.deviceTokenModel.find(query).exec();
  }

  /**
   * Get platform statistics (Android/iOS users count)
   */
  async getPlatformStatistics() {
    const allTokens = await this.deviceTokenModel.find({}).lean().exec();
    
    // Get unique user IDs per platform
    const androidUsers = new Set<string>();
    const iosUsers = new Set<string>();
    const allUsers = new Set<string>();
    
    allTokens.forEach((token: any) => {
      const userId = String(token.userId || '').trim();
      if (!userId) return;
      
      allUsers.add(userId);
      const platform = String(token.platform || '').toLowerCase();
      
      if (platform === 'android') {
        androidUsers.add(userId);
      } else if (platform === 'ios') {
        iosUsers.add(userId);
      }
    });
    
    return {
      totalUsers: allUsers.size,
      androidUsers: androidUsers.size,
      iosUsers: iosUsers.size,
      totalDevices: allTokens.length,
      androidDevices: allTokens.filter((t: any) => String(t.platform || '').toLowerCase() === 'android').length,
      iosDevices: allTokens.filter((t: any) => String(t.platform || '').toLowerCase() === 'ios').length,
    };
  }

  /**
   * Backward compatibility: sendPushToTargets
   * Converts targets to userIds and calls sendPushToUsers
   */
  async sendPushToTargets(
    targets: NotificationTarget[],
    payload: PushNotificationPayload,
    type: 'request' | 'offer' | 'message' | 'system' = 'system',
  ): Promise<void> {
    // Extract userIds from targets
    const userIds = targets
      .map((t) => t.userId)
      .filter((uid): uid is string => !!uid);

    if (userIds.length > 0) {
      await this.sendPushToUsers(userIds, payload, type);
    } else if (targets.some((t) => t.role === 'user')) {
      // Broadcast to all users
      await this.broadcastToAllUsers(payload);
    }
  }
}
