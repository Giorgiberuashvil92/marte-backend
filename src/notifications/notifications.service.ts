import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Store, StoreDocument } from '../schemas/store.schema';
import { DeviceToken, DeviceTokenDocument } from './device-token.schema';
import {
  Notification,
  NotificationDocument,
} from '../schemas/notification.schema';

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
    @InjectModel(DeviceToken.name)
    private deviceTokenModel: Model<DeviceTokenDocument>,
  ) {}

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

  private async getTokensForTargets(
    targets: NotificationTarget[],
  ): Promise<string[]> {
    const userIds = targets
      .map((t) => t.userId)
      .filter((v): v is string => typeof v === 'string');
    if (userIds.length === 0) return [];
    const docs = await this.deviceTokenModel
      .find({ userId: { $in: userIds } })
      .select({ token: 1 })
      .lean();
    return docs.map((d) => d.token);
  }

  private async sendFcm(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<void> {
    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey || tokens.length === 0) {
      console.log('FCM not configured or no tokens. Skipping real send.');
      return;
    }
    const endpoint = 'https://fcm.googleapis.com/fcm/send';
    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += 1000)
      chunks.push(tokens.slice(i, i + 1000));
    await Promise.all(
      chunks.map(async (chunk) => {
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${serverKey}`,
          },
          body: JSON.stringify({
            registration_ids: chunk,
            notification: {
              title: payload.title,
              body: payload.body,
              sound: payload.sound || 'default',
            },
            data: payload.data || {},
          }),
        });
      }),
    );
  }

  async sendPushToTargets(
    targets: NotificationTarget[],
    payload: PushNotificationPayload,
    type: 'request' | 'offer' | 'message' | 'system' = 'system',
  ): Promise<void> {
    const notifications = targets.map((target) => ({
      target,
      payload,
      type,
      status: 'pending' as const,
      createdAt: Date.now(),
    }));

    await this.notificationModel.insertMany(notifications);
    const tokens = await this.getTokensForTargets(targets);
    if (tokens.length > 0) await this.sendFcm(tokens, payload);
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
  }): Promise<void> {
    // Filter stores by type and by specialization containing vehicle make/model/year

    const payload: PushNotificationPayload = {
      title: 'ახალი მოთხოვნა',
      body: `${requestData.vehicle.make} ${requestData.vehicle.model} - ${requestData.partName}`,
      data: {
        type: 'new_request',
        requestData: JSON.stringify(requestData),
      },
    };

    // Basic matching by store.type and store.specializations strings
    const make = (requestData.vehicle.make || '').toLowerCase();
    const model = (requestData.vehicle.model || '').toLowerCase();
    const year = (requestData.vehicle.year || '').toString();

    const stores = await this.storeModel
      .find({
        type: { $in: ['ავტონაწილები', 'სამართ-დასახურებელი'] },
        $or: [
          { specializations: { $elemMatch: { $regex: make, $options: 'i' } } },
          { specializations: { $elemMatch: { $regex: model, $options: 'i' } } },
          { specializations: { $elemMatch: { $regex: year, $options: 'i' } } },
        ],
      })
      .select({ _id: 1 })
      .lean();

    const targets: NotificationTarget[] = stores.map((s) => ({
      storeId: String(s._id),
      role: 'store',
    }));

    if (targets.length === 0) {
      // fallback: at least notify partners
      await this.sendPushToTargets([{ role: 'store' }], payload, 'request');
      return;
    }

    await this.sendPushToTargets(targets, payload, 'request');
  }

  async sendOfferNotificationToUser(
    userId: string,
    offerData: {
      storeName: string;
      price: number;
      partName: string;
    },
  ): Promise<void> {
    const payload: PushNotificationPayload = {
      title: 'ახალი შეთავაზება',
      body: `${offerData.storeName} - ${offerData.partName} (${offerData.price}₾)`,
      data: {
        type: 'new_offer',
        offerData: JSON.stringify(offerData),
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
  }) {
    await this.deviceTokenModel.updateOne(
      { token: dto.token },
      { $set: { userId: dto.userId, platform: dto.platform || 'unknown' } },
      { upsert: true },
    );
    return { ok: true };
  }
}
