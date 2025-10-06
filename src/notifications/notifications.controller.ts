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
    },
  ) {
    try {
      await this.notificationsService.registerDevice(body);
      return { success: true };
    } catch (error) {
      throw new BadRequestException({ success: false });
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
