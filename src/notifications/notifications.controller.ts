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
    },
  ) {
    try {
      const result = await this.notificationsService.broadcastToAllUsers({
        title: body.title || 'მადლობა',
        body: body.body || 'მადლობა რომ შემოგვიერთდით! 🎉',
        data: body.data || {},
      });
      return {
        ...result,
        success: true,
        message: 'Broadcast notification sent successfully',
      };
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
}
