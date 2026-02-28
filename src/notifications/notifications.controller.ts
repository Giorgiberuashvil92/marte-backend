import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send-sms')
  async sendSms(
    @Body()
    body: {
      to: string;
      message: string;
      from?: string;
    },
  ) {
    const res = await this.notificationsService.sendSms({
      to: body.to,
      body: body.message,
      from: body.from,
    });
    if (!res.ok) {
      throw new BadRequestException({
        success: false,
        message: 'SMS გაგზავნა ვერ მოხერხდა',
        error: res.error,
      });
    }
    return { success: true, sid: res.sid };
  }

  @Post('send-request-notification')
  async sendRequestNotification(
    @Body()
    body: {
      partName: string;
      vehicle: {
        make: string;
        model: string;
        year?: string;
        submodel?: string;
      };
      location?: string;
      userId: string;
    },
  ) {
    try {
      await this.notificationsService.sendRequestNotificationToRelevantStores(
        body,
      );
      return {
        success: true,
        message: 'Push notifications გაიგზავნა relevant stores-ზე',
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Push notifications-ის გაგზავნა ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Post('send-offer-notification')
  async sendOfferNotification(
    @Body()
    body: {
      userId: string;
      storeName: string;
      price: number;
      partName: string;
    },
  ) {
    try {
      await this.notificationsService.sendOfferNotificationToUser(body.userId, {
        storeName: body.storeName,
        price: body.price,
        partName: body.partName,
      });
      return {
        success: true,
        message: 'Push notification გაიგზავნა user-ზე',
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Push notification-ის გაგზავნა ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Post('send-message-notification')
  async sendMessageNotification(
    @Body()
    body: {
      targetUserId: string;
      fromName: string;
      message: string;
      offerId: string;
    },
  ) {
    try {
      await this.notificationsService.sendMessageNotification(
        body.targetUserId,
        {
          fromName: body.fromName,
          message: body.message,
          offerId: body.offerId,
        },
      );
      return {
        success: true,
        message: 'Message notification გაიგზავნა',
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Message notification-ის გაგზავნა ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Get('devices')
  async getDeviceTokens(@Query('userId') userId?: string) {
    try {
      console.log(
        '📱 [NOTIFICATIONS] GET /notifications/devices called with userId:',
        userId,
      );
      const tokens = await this.notificationsService.getDeviceTokens(userId);
      console.log('📱 [NOTIFICATIONS] Found tokens:', tokens.length);
      return {
        success: true,
        data: tokens,
      };
    } catch (error) {
      console.error('❌ [NOTIFICATIONS] Error getting device tokens:', error);
      throw new BadRequestException({
        success: false,
        message: 'Device tokens-ის მიღება ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Post('broadcast')
  async broadcastNotification(
    @Body()
    body: {
      title?: string;
      body?: string;
      data?: Record<string, any>;
      userIds?: string[];
      role?: string;
      active?: boolean;
    },
  ) {
    try {
      const payload = {
        title: body.title || 'მადლობა',
        body: body.body || 'მადლობა რომ შემოგვიერთდით! 🎉',
        data: body.data || {},
      };

      if (
        body.userIds &&
        Array.isArray(body.userIds) &&
        body.userIds.length > 0
      ) {
        const userIds = body.userIds.filter(
          (id): id is string => typeof id === 'string' && id.length > 0,
        );
        if (userIds.length > 0) {
          await this.notificationsService.sendPushToUsers(
            userIds,
            payload,
            'system',
          );
          return {
            success: true,
            sent: userIds.length,
            total: userIds.length,
            message: `Notification sent to ${userIds.length} users`,
          };
        }
      }

      // თუ role ან active მოწოდებულია, მოვძებნოთ users-ები
      if (body.role || typeof body.active === 'boolean') {
        const userIds: string[] =
          await this.notificationsService.getUserIdsByFilter({
            role: body.role,
            active: body.active,
          });

        if (userIds.length === 0) {
          return {
            success: false,
            sent: 0,
            total: 0,
            message: 'No users found matching the criteria',
          };
        }

        await this.notificationsService.sendPushToUsers(
          userIds,
          payload,
          'system',
        );
        return {
          success: true,
          sent: userIds.length,
          total: userIds.length,
          message: `Notification sent to ${userIds.length} users`,
        };
      }

      // თუ არაფერი არ არის მოწოდებული, ვერ გავაგზავნოთ - უსაფრთხოების მიზნით
      throw new BadRequestException({
        success: false,
        message: 'გთხოვთ მიუთითოთ userIds, role ან active პარამეტრი. Broadcast to all არ არის დაშვებული.',
      });
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Broadcast notification-ის გაგზავნა ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Get('user/:userId')
  async getUserNotifications(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const notifications =
        await this.notificationsService.getUserNotifications(
          userId,
          limit ? parseInt(limit) : 50,
        );
      return {
        success: true,
        data: notifications,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Notifications-ის მიღება ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Get('partner/:partnerId')
  async getPartnerNotifications(
    @Param('partnerId') partnerId: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const notifications =
        await this.notificationsService.getPartnerNotifications(
          partnerId,
          limit ? parseInt(limit) : 50,
        );
      return {
        success: true,
        data: notifications,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Partner notifications-ის მიღება ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Post('register-device')
  async registerDevice(
    @Body()
    body: {
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
    },
  ) {
    try {
      await this.notificationsService.registerDevice(body);
      return { success: true };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Patch(':id/delivered')
  async markAsDelivered(@Param('id') id: string) {
    try {
      await this.notificationsService.markAsDelivered(id);
      return {
        success: true,
        message: 'Notification marked as delivered',
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Notification update ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    try {
      await this.notificationsService.markAsRead(id);
      return {
        success: true,
        message: 'Notification marked as read',
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Notification update ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Test endpoints for notification navigation testing
  @Post('test/garage-reminder')
  async testGarageReminder(@Body() body: { userId: string }) {
    try {
      await this.notificationsService.sendPushToTargets(
        [{ userId: body.userId }],
        {
          title: '⏰ შეხსენება დღეს',
          body: 'ზეთის შეცვლა • დღეს უნდა შესრულდეს',
          data: {
            type: 'garage_reminder',
            screen: 'Garage',
            reminderId: 'test_reminder_123',
            carId: 'test_car_456',
            reminderType: 'maintenance',
          },
          sound: 'default',
          badge: 1,
        },
        'system',
      );
      return {
        success: true,
        message: 'Garage reminder test notification sent',
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Test notification-ის გაგზავნა ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Post('test/chat-message')
  async testChatMessage(@Body() body: { userId: string; offerId?: string }) {
    try {
      await this.notificationsService.sendPushToTargets(
        [{ userId: body.userId }],
        {
          title: '💬 ახალი მესიჯი',
          body: 'გამარჯობა, როგორ ხარ?',
          data: {
            type: 'chat_message',
            screen: 'Chat',
            chatId: body.offerId || 'test_offer_123',
            requestId: body.offerId || 'test_offer_123',
            offerId: body.offerId || 'test_offer_123',
          },
          sound: 'default',
          badge: 1,
        },
        'message',
      );
      return { success: true, message: 'Chat message test notification sent' };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Test notification-ის გაგზავნა ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Post('test/carwash-booking')
  async testCarwashBooking(
    @Body() body: { userId: string; carwashId?: string },
  ) {
    try {
      await this.notificationsService.sendPushToTargets(
        [{ userId: body.userId }],
        {
          title: '⏰ შეხსენება ჯავშანზე',
          body: 'სამრეცხაო • დაწყება 14:00',
          data: {
            type: 'carwash_booking_reminder',
            screen: 'Bookings',
            carwashId: body.carwashId || 'test_carwash_123',
            bookingId: 'test_booking_456',
          },
          sound: 'default',
          badge: 1,
        },
        'system',
      );
      return {
        success: true,
        message: 'Carwash booking test notification sent',
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Test notification-ის გაგზავნა ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Post('test/new-request')
  async testNewRequest(@Body() body: { userId: string; requestId?: string }) {
    try {
      await this.notificationsService.sendPushToTargets(
        [{ userId: body.userId }],
        {
          title: '🆕 ახალი მოთხოვნა',
          body: 'ახალი მოთხოვნა მიღებულია',
          data: {
            type: 'new_request',
            screen: 'RequestDetails',
            requestId: body.requestId || 'test_request_123',
          },
          sound: 'default',
          badge: 1,
        },
        'request',
      );
      return { success: true, message: 'New request test notification sent' };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Test notification-ის გაგზავნა ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Post('test/new-offer')
  async testNewOffer(@Body() body: { userId: string }) {
    try {
      await this.notificationsService.sendPushToTargets(
        [{ userId: body.userId }],
        {
          title: '💰 ახალი შეთავაზება',
          body: 'თქვენ გაქვთ ახალი შეთავაზება',
          data: {
            type: 'new_offer',
            screen: 'OfferDetails',
          },
          sound: 'default',
          badge: 1,
        },
        'offer',
      );
      return { success: true, message: 'New offer test notification sent' };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Test notification-ის გაგზავნა ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Post('test/subscription')
  async testSubscription(@Body() body: { userId: string }) {
    try {
      await this.notificationsService.sendPushToTargets(
        [{ userId: body.userId }],
        {
          title: '⭐ Premium აქტივირებულია',
          body: 'გილოცავთ! თქვენი Premium გამოწერა აქტივირებულია',
          data: {
            type: 'subscription_activated',
            screen: 'Premium',
          },
          sound: 'default',
          badge: 1,
        },
        'system',
      );
      return { success: true, message: 'Subscription test notification sent' };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Test notification-ის გაგზავნა ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Post('test/ai-recommendation')
  async testAIRecommendation(
    @Body() body: { userId: string; requestId?: string },
  ) {
    try {
      await this.notificationsService.sendPushToTargets(
        [{ userId: body.userId }],
        {
          title: '🤖 AI რეკომენდაცია',
          body: 'გვაქვს რეკომენდაცია თქვენი მოთხოვნისთვის',
          data: {
            type: 'ai_recommendation',
            screen: 'AIRecommendations',
            requestId: body.requestId || 'test_request_123',
          },
          sound: 'default',
          badge: 1,
        },
        'system',
      );
      return {
        success: true,
        message: 'AI recommendation test notification sent',
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Test notification-ის გაგზავნა ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Post('test/business-offer')
  async testBusinessOffer(
    @Body() body: { partnerId: string; requestId?: string; offerId?: string },
  ) {
    try {
      await this.notificationsService.sendPushToTargets(
        [{ partnerId: body.partnerId }],
        {
          title: '💼 ახალი შეთავაზება',
          body: 'თქვენ გაქვთ ახალი შეთავაზება',
          data: {
            type: 'offer',
            screen: 'OfferDetails',
            requestId: body.requestId || 'test_request_123',
            offerId: body.offerId || 'test_offer_123',
            target: {
              partnerId: body.partnerId,
              role: 'partner',
            },
          },
          sound: 'default',
          badge: 1,
        },
        'offer',
      );
      return {
        success: true,
        message: 'Business offer test notification sent',
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Test notification-ის გაგზავნა ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Post('test/business-request')
  async testBusinessRequest(
    @Body() body: { partnerId: string; requestId?: string },
  ) {
    try {
      await this.notificationsService.sendPushToTargets(
        [{ partnerId: body.partnerId }],
        {
          title: '📋 ახალი მოთხოვნა',
          body: 'თქვენ გაქვთ ახალი მოთხოვნა',
          data: {
            type: 'request',
            screen: 'RequestDetails',
            requestId: body.requestId || 'test_request_123',
            target: {
              partnerId: body.partnerId,
              role: 'partner',
            },
          },
          sound: 'default',
          badge: 1,
        },
        'request',
      );
      return {
        success: true,
        message: 'Business request test notification sent',
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Test notification-ის გაგზავნა ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Post('test/review')
  async testReview(@Body() body: { userId: string }) {
    try {
      await this.notificationsService.sendPushToTargets(
        [{ userId: body.userId }],
        {
          title: '⭐ შეფასება',
          body: 'როგორ მოგწონს Marte? დატოვე შეფასება აპლიკაციაში!',
          data: {
            type: 'review',
            screen: 'Review',
          },
          sound: 'default',
          badge: 1,
        },
        'system',
      );
      return {
        success: true,
        message: 'Review test notification sent',
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Test notification-ის გაგზავნა ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Post('test/carfax')
  async testCarfax(@Body() body: { userId: string }) {
    try {
      await this.notificationsService.sendPushToTargets(
        [{ userId: body.userId }],
        {
          title: '🚗 CarFax',
          body: 'CarFax მოძებნა უკვე შესაძლებელია შეიძინე პრემიუმი და მიიღე 5 უფასო CarFax რეპორტი',
          data: {
            type: 'carfax',
            screen: 'Carfax',
          },
          sound: 'default',
          badge: 1,
        },
        'system',
      );
      return {
        success: true,
        message: 'Carfax test notification sent',
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Test notification-ის გაგზავნა ვერ მოხერხდა',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
