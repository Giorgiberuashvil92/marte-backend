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

  async createNotification(
    target: NotificationTarget,
    payload: PushNotificationPayload,
    type: 'request' | 'offer' | 'message' | 'system' = 'system',
  ): Promise<Notification> {
    const notification = new this.notificationModel({
      target,
      payload,
      type,
      status: 'pending',
      createdAt: Date.now(),
    });

    return await notification.save();
  }

  /**
   * Converts ownerId to user.id (userId for device tokens)
   * ownerId might be user._id (ObjectId) or user.id (string)
   */
  private async getUserIdFromOwnerId(ownerId: string): Promise<string | null> {
    if (!ownerId) return null;

    console.log(`🔍 [NOTIFICATIONS] Converting ownerId to userId: ${ownerId}`);

    // First, try to find user by _id (ObjectId) if ownerId is a valid ObjectId
    if (Types.ObjectId.isValid(ownerId)) {
      try {
        const userByObjectId = await this.userModel.findById(ownerId).lean();
        if (userByObjectId && userByObjectId.id) {
          console.log(
            `✅ [NOTIFICATIONS] Found user by _id: ownerId=${ownerId} -> userId=${userByObjectId.id}`,
          );
          return String(userByObjectId.id);
        }
      } catch (error) {
        console.log(
          `⚠️ [NOTIFICATIONS] Error finding user by _id: ${ownerId}`,
          error,
        );
      }
    }

    // If not found by _id, try to find by id (string like "usr_1759840730669")
    try {
      const userById = await this.userModel.findOne({ id: ownerId }).lean();
      if (userById && userById.id) {
        console.log(
          `✅ [NOTIFICATIONS] Found user by id: ownerId=${ownerId} -> userId=${userById.id}`,
        );
        return String(userById.id);
      }
    } catch (error) {
      console.log(
        `⚠️ [NOTIFICATIONS] Error finding user by id: ${ownerId}`,
        error,
      );
    }

    // If still not found, return null
    console.warn(`⚠️ [NOTIFICATIONS] User not found for ownerId: ${ownerId}`);
    return null;
  }

  private async getTokensForTargets(
    targets: NotificationTarget[],
  ): Promise<string[]> {
    const userIds = targets
      .map((t) => t.userId)
      .filter((v): v is string => typeof v === 'string');
    if (userIds.length === 0) {
      console.log('⚠️ [NOTIFICATIONS] No userIds found in targets:', targets);
      return [];
    }
    console.log('🔍 [NOTIFICATIONS] Looking for tokens for userIds:', userIds);

    // Debug: Check if these users exist and what their phone numbers are
    const usersWithoutTokens = await this.userModel
      .find({ id: { $in: userIds } })
      .select({ id: 1, phone: 1 })
      .lean();
    console.log('🔍 [NOTIFICATIONS] Users without tokens:', usersWithoutTokens);

    // Debug: Check what tokens exist in database for these users
    const allTokensForUsers = await this.deviceTokenModel
      .find({ userId: { $in: userIds } })
      .select({ userId: 1, token: 1, platform: 1 })
      .lean();
    console.log(
      `🔍 [NOTIFICATIONS] All tokens in DB for these users:`,
      allTokensForUsers.map((t) => ({
        userId: t.userId,
        platform: t.platform,
        tokenPreview: t.token?.substring(0, 30) + '...',
      })),
    );

    // Also check total tokens count in database for debugging
    const totalTokensCount = await this.deviceTokenModel.countDocuments({});
    console.log(
      `🔍 [NOTIFICATIONS] Total device tokens in database: ${totalTokensCount}`,
    );

    // Show all tokens in database with their userIds (for debugging)
    const allTokens = await this.deviceTokenModel
      .find({})
      .select({ userId: 1, platform: 1, token: 1 })
      .limit(10)
      .lean();
    console.log(
      `🔍 [NOTIFICATIONS] All device tokens in database (first 10):`,
      allTokens.map((t) => ({
        userId: t.userId,
        platform: t.platform,
        tokenPreview: t.token?.substring(0, 30) + '...',
      })),
    );

    const docs = await this.deviceTokenModel
      .find({ userId: { $in: userIds } })
      .select({ token: 1, userId: 1 })
      .lean();

    // Debug: Check exact userId matches
    console.log('🔍 [NOTIFICATIONS] Query details:', {
      searchedUserIds: userIds,
      foundDocs: docs.map((d) => ({
        userId: d.userId,
        userIdType: typeof d.userId,
        userIdLength: d.userId?.length,
        tokenExists: !!d.token,
      })),
    });

    // Check for exact string matches
    userIds.forEach((uid) => {
      const exactMatches = docs.filter((d) => String(d.userId) === String(uid));
      const containsMatches = docs.filter((d) =>
        String(d.userId).includes(String(uid)),
      );
      console.log(`🔍 [NOTIFICATIONS] UserId ${uid} matches:`, {
        exact: exactMatches.length,
        contains: containsMatches.length,
        allFound: docs.map((d) => String(d.userId)),
      });
    });

    const tokens = docs.map((d) => d.token).filter((t): t is string => !!t);
    console.log(
      `📱 [NOTIFICATIONS] Found ${tokens.length} device tokens for ${userIds.length} users`,
      userIds.map((uid) => {
        const found = docs.filter((d) => String(d.userId) === String(uid));
        return {
          userId: uid,
          tokenCount: found.length,
          found: found.length > 0,
        };
      }),
    );
    return tokens;
  }

  private async sendFcm(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<void> {
    console.log(
      '🚀 [FCM] sendFcm called with tokens:',
      tokens?.length || 0,
      'payload title:',
      payload?.title,
    );
    if (!tokens || tokens.length === 0) {
      console.log('No tokens to send. Skipping.');
      return;
    }

    // გამოიყენე Firebase Admin SDK (HTTP v1 API) — normalize default/namespace
    const fa = await import('firebase-admin');
    const admin: any = (fa as any).default ?? fa;

    // Lazy-init: თუ უცენრად მივედით აქამდე და Firebase Admin ჯერ არაა ინიციალიზებული,
    // ვცადოთ ადგილზე ინიციალიზაცია იგივე პროცესში, რომ push არ გამოტოვოს
    if (!admin.apps || !admin.apps.length) {
      try {
        // 1) სცადე Application Default Credentials (ഉ GOOGLE_APPLICATION_CREDENTIALS ან გარემო კონფიგი)
        try {
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
          });
          console.log(
            '✅ Firebase Admin initialized via applicationDefault (lazy)',
          );
        } catch {
          // 2) ფაილიდან წაკითხვა (იგივე default გზა, რაც main.ts-შია)
          const fs = await import('fs');
          const path =
            process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
            './firebase-adminsdk.json';
          const json = JSON.parse(fs.readFileSync(path, 'utf8'));
          if (!admin?.credential?.cert) {
            throw new Error('admin.credential.cert is undefined');
          }
          admin.initializeApp({
            credential: admin.credential.cert(json),
          });
          console.log('✅ Firebase Admin initialized from file (lazy):', path);
        }
      } catch (e) {
        console.log('❌ Lazy Firebase init failed, skipping push.', e);
        return;
      }
    }

    const messaging = admin.messaging();

    // გაგზავნე multicast message (ერთდროულად რამდენიმე token-ზე)
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
      tokens: tokens.slice(0, 500), // FCM limit: 500 tokens per request
    };

    try {
      console.log(
        '📦 [FCM] Attempting batch sendMulticast to',
        message.tokens.length,
        'tokens',
      );
      const response = await messaging.sendMulticast(message);
      console.log(
        `✅ FCM sent: ${response.successCount} success, ${response.failureCount} failed`,
      );

      // თუ არის failed tokens, წაშალე invalid tokens
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            console.log('❌ Failed token:', tokens[idx], resp.error?.message);
          }
        });

        // წაშალე invalid tokens database-დან
        if (failedTokens.length > 0) {
          await this.deviceTokenModel.deleteMany({
            token: { $in: failedTokens },
          });
          console.log(`🗑️ Removed ${failedTokens.length} invalid tokens`);
        }
      }

      // თუ 500+ tokens არის, გაგზავნე დანარჩენი
      if (tokens.length > 500) {
        await this.sendFcm(tokens.slice(500), payload);
      }
    } catch (error) {
      console.error('❌ FCM send error:', error);

      // Fallback: some environments return 404 on /batch endpoint.
      // Try per-token send using messages:send API instead of batch.
      const errMsg = error?.errorInfo?.message || String(error);
      if (errMsg.includes('/batch') || errMsg.includes('404')) {
        console.log(
          '⚠️ Falling back to per-token send... tokens:',
          tokens.length,
        );
        let successCount = 0;
        let failureCount = 0;
        const invalidTokens: string[] = [];

        // Helper: exponential backoff sleep
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const isTransient = (code?: string, msg?: string) => {
          const m = (msg || '').toLowerCase();
          return (
            code === 'internal' ||
            code === 'unavailable' ||
            code === 'deadline-exceeded' ||
            m.includes('internal error') ||
            m.includes('backend error') ||
            m.includes('503')
          );
        };

        for (const token of tokens) {
          let attempt = 0;
          let sent = false;
          let lastErr: any = null;
          while (attempt < 3 && !sent) {
            try {
              await messaging.send({
                notification: message.notification,
                data: message.data,
                android: message.android as any,
                apns: message.apns as any,
                token,
              } as any);
              successCount += 1;
              sent = true;
              console.log(
                '✅ Single-send delivered to token:',
                token.substring(0, 30) + '...',
              );
            } catch (e: any) {
              lastErr = e;
              const code: string | undefined = e?.errorInfo?.code || e?.code;
              const msg: string | undefined =
                e?.errorInfo?.message || e?.message;

              // Collect invalid tokens to clean up
              if (
                code === 'messaging/registration-token-not-registered' ||
                code === 'messaging/invalid-registration-token' ||
                (msg || '').toLowerCase().includes('not registered')
              ) {
                invalidTokens.push(token);
                console.log(
                  '🗑️ Marking invalid token for deletion:',
                  token.substring(0, 30) + '...',
                );
                break; // no retry for invalid token
              }

              // Retry on transient errors
              if (isTransient(code, msg) && attempt < 2) {
                const backoffMs = 200 * Math.pow(2, attempt); // 200ms, 400ms
                console.log(
                  `⏳ Transient FCM error (${code}). Retrying in ${backoffMs}ms (attempt ${attempt + 1}/3)`,
                );
                await sleep(backoffMs);
                attempt += 1;
                continue;
              }

              // Non-transient failure
              failureCount += 1;
              console.log('❌ Failed token (single send):', token, msg || e);
              break;
            }
          }
        }

        // Cleanup invalid tokens from DB
        if (invalidTokens.length > 0) {
          await this.deviceTokenModel.deleteMany({
            token: { $in: invalidTokens },
          });
          console.log(
            `🗑️ Removed ${invalidTokens.length} invalid tokens (single-send)`,
          );
        }

        console.log(
          `✅ FCM single-send summary: ${successCount} success, ${failureCount} failed`,
        );
      }
    }
  }

  async sendPushToTargets(
    targets: NotificationTarget[],
    payload: PushNotificationPayload,
    type: 'request' | 'offer' | 'message' | 'system' = 'system',
  ): Promise<void> {
    console.log(
      '📬 [NOTIFICATIONS] sendPushToTargets called. type:',
      type,
      'targets count:',
      targets.length,
      'title:',
      payload?.title,
    );
    const notifications = targets.map((target) => ({
      target,
      payload,
      type,
      status: 'pending' as const,
      createdAt: Date.now(),
    }));

    await this.notificationModel.insertMany(notifications);
    const tokens = await this.getTokensForTargets(targets);
    console.log('📬 [NOTIFICATIONS] Tokens to send:', tokens.length);
    if (tokens.length > 0) {
      await this.sendFcm(tokens, payload);
    } else {
      console.log(
        '⚠️ [NOTIFICATIONS] No tokens found for targets; skipping FCM send',
      );
    }
  }

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
    // Filter stores by type and by specialization containing vehicle make/model/year
    console.log('🔎 [NOTIFICATIONS] Matching stores for request:', {
      make: requestData.vehicle?.make,
      model: requestData.vehicle?.model,
      year: requestData.vehicle?.year,
      partName: requestData.partName,
      userId: requestData.userId,
    });

    const payload: PushNotificationPayload = {
      title: 'MARTE - მართე ',
      body: `ჩვენ გიპოვეთ მოთხოვნა რომელიც დაგაინტერესებს ... ! ..
      ${requestData.partName} - ამ ნაწილზე გაქვთ შეთავაზება`,
      data: {
        type: 'new_request',
        requestData: JSON.stringify(requestData),
        screen: 'RequestDetails',
        requestId: requestData.requestId || '',
      },
    };

    const make = (requestData.vehicle.make || '').toLowerCase();
    const model = (requestData.vehicle.model || '').toLowerCase();
    const year = (requestData.vehicle.year || '').toString();

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

    // თუ არ არის specializations match, მაინც ყველა store-ს გაგზავნე
    if (storeSpecializations.length > 0) {
      storeQuery.push({ $or: storeSpecializations });
    }

    const stores = await this.storeModel
      .find(
        storeSpecializations.length > 0
          ? { $and: storeQuery }
          : { type: { $in: ['ავტონაწილები', 'სამართ-დასახურებელი'] } },
      )
      .select({ _id: 1, name: 1, specializations: 1, ownerId: 1 })
      .lean();

    console.log(
      '✅ [NOTIFICATIONS] Matched stores count:',
      stores.length,
      'ids:',
      stores.map((s) =>
        (s._id as unknown as { toString: () => string }).toString(),
      ),
    );

    // Convert ownerIds to user ids for stores
    const storeTargetsPromises = stores
      .filter((s): s is typeof s & { ownerId: string } => {
        return !!(s as { ownerId?: string }).ownerId;
      })
      .map(async (s) => {
        const userId = await this.getUserIdFromOwnerId(String(s.ownerId));
        if (!userId) return null;
        return {
          userId,
          storeId: (s._id as unknown as { toString: () => string }).toString(),
          role: 'store' as const,
        } as NotificationTarget;
      });

    const storeTargets = (await Promise.all(storeTargetsPromises)).filter(
      (t): t is NotificationTarget => t !== null,
    );
    const targets: NotificationTarget[] = [...storeTargets];

    const dismantlerQuery: Record<string, unknown>[] = [];

    // Brand match
    if (make) {
      dismantlerQuery.push({ brand: { $regex: make, $options: 'i' } });
    }

    // Model match
    if (model) {
      dismantlerQuery.push({ model: { $regex: model, $options: 'i' } });
    }

    // Year match (თუ year არის range-ში)
    if (year) {
      const yearNum = Number(year);
      if (!Number.isNaN(yearNum)) {
        dismantlerQuery.push({
          $and: [
            { yearFrom: { $lte: yearNum } },
            { yearTo: { $gte: yearNum } },
          ],
        });
      }
    }

    const dismantlers = await this.dismantlerModel
      .find(dismantlerQuery.length > 0 ? { $or: dismantlerQuery } : {})
      .select({
        _id: 1,
        name: 1,
        brand: 1,
        model: 1,
        yearFrom: 1,
        yearTo: 1,
        ownerId: 1,
      })
      .lean();

    console.log(
      '✅ [NOTIFICATIONS] Matched dismantlers count:',
      dismantlers.length,
      'ids:',
      dismantlers.map((d) =>
        (d._id as unknown as { toString: () => string }).toString(),
      ),
    );

    // Convert ownerIds to user ids for dismantlers
    const dismantlerTargetsPromises = dismantlers
      .filter((d): d is typeof d & { ownerId: string } => {
        return !!(d as { ownerId?: string }).ownerId;
      })
      .map(async (d) => {
        const userId = await this.getUserIdFromOwnerId(String(d.ownerId));
        if (!userId) return null;
        return {
          userId,
          dismantlerId: (
            d._id as unknown as { toString: () => string }
          ).toString(),
          role: 'dismantler' as const,
        } as NotificationTarget;
      });

    const dismantlerTargets = (
      await Promise.all(dismantlerTargetsPromises)
    ).filter((t): t is NotificationTarget => t !== null);

    targets.push(...dismantlerTargets);

    if (targets.length === 0) {
      // fallback: at least notify partners
      console.log(
        '⚠️ [NOTIFICATIONS] No matching stores found, sending fallback broadcast to role=store',
      );
      await this.sendPushToTargets([{ role: 'store' }], payload, 'request');
      return;
    }

    console.log('📤 [NOTIFICATIONS] Sending push to targets:', targets);
    await this.sendPushToTargets(targets, payload, 'request');
    console.log('📨 [NOTIFICATIONS] Push dispatch initiated');
  }

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

    await this.sendPushToTargets([{ userId }], payload, 'offer');
  }

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

    await this.sendPushToTargets(
      [{ userId: targetUserId }],
      payload,
      'message',
    );
  }

  async markAsDelivered(notificationId: string): Promise<void> {
    await this.notificationModel.findByIdAndUpdate(notificationId, {
      status: 'delivered',
      deliveredAt: Date.now(),
    });
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.notificationModel.findByIdAndUpdate(notificationId, {
      status: 'read',
      readAt: Date.now(),
    });
  }

  async getUserNotifications(
    userId: string,
    limit = 50,
  ): Promise<Notification[]> {
    return this.notificationModel
      .find({
        $or: [{ 'target.userId': userId }, { 'target.role': 'user' }],
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

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
    console.log('📱 [NOTIFICATIONS] Registering device token:', {
      userId: dto.userId,
      token: dto.token.substring(0, 50) + '...',
      platform: dto.platform || 'unknown',
      deviceInfo: dto.deviceInfo ? '✅ Provided' : '❌ Not provided',
    });

    const updateData: any = {
      userId: dto.userId,
      platform: dto.platform || 'unknown',
    };

    if (dto.deviceInfo) {
      updateData.deviceInfo = dto.deviceInfo;
      console.log('📱 [NOTIFICATIONS] Device info:', {
        deviceName: dto.deviceInfo.deviceName,
        modelName: dto.deviceInfo.modelName,
        brand: dto.deviceInfo.brand,
        osName: dto.deviceInfo.osName,
        osVersion: dto.deviceInfo.osVersion,
        appVersion: dto.deviceInfo.appVersion,
      });
    }

    const result = await this.deviceTokenModel.updateOne(
      { token: dto.token },
      {
        $set: updateData,
      },
      { upsert: true },
    );

    console.log('✅ [NOTIFICATIONS] Device token registration result:', {
      matched: result.matchedCount,
      modified: result.modifiedCount,
      upserted: result.upsertedCount,
      userId: dto.userId,
    });

    // Verify the token was saved correctly
    const savedToken = await this.deviceTokenModel
      .findOne({ token: dto.token })
      .lean();
    if (savedToken) {
      console.log('✅ [NOTIFICATIONS] Verified saved token:', {
        userId: savedToken.userId,
        platform: savedToken.platform,
        tokenExists: !!savedToken.token,
        hasDeviceInfo: !!savedToken.deviceInfo,
      });
    } else {
      console.error('❌ [NOTIFICATIONS] Token not found after saving!');
    }

    return { ok: true };
  }

  async getDeviceTokens(userId?: string): Promise<DeviceTokenDocument[]> {
    const query: any = {};
    if (userId) {
      query.userId = userId;
    }
    return this.deviceTokenModel.find(query).sort({ createdAt: -1 }).lean();
  }

  async broadcastToAllUsers(payload: {
    title: string;
    body: string;
    data?: Record<string, any>;
  }): Promise<{ sent: number; failed: number; total: number }> {
    console.log('📢 [NOTIFICATIONS] Broadcasting to all users:', payload.title);

    // Get all device tokens
    const allTokens = await this.deviceTokenModel.find({}).lean();
    const tokens = allTokens
      .map((t) => t.token)
      .filter((token): token is string => !!token);

    console.log(
      `📢 [NOTIFICATIONS] Found ${tokens.length} device tokens to send`,
    );

    if (tokens.length === 0) {
      return { sent: 0, failed: 0, total: 0 };
    }

    // Send to all tokens
    let sent = 0;
    let failed = 0;

    try {
      await this.sendFcm(tokens, {
        ...payload,
        data: payload.data || {},
        sound: 'default',
        badge: 1,
      });
      sent = tokens.length;
      console.log(`✅ [NOTIFICATIONS] Broadcast sent to ${sent} devices`);
    } catch (error) {
      console.error('❌ [NOTIFICATIONS] Broadcast failed:', error);
      failed = tokens.length;
    }

    return {
      sent,
      failed,
      total: tokens.length,
    };
  }
}
