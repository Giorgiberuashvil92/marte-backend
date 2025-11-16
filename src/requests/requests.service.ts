import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request, RequestDocument } from '../schemas/request.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { AINotificationsService } from '../ai/ai-notifications.service';

@Injectable()
export class RequestsService {
  constructor(
    @InjectModel(Request.name)
    private readonly requestModel: Model<RequestDocument>,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => AINotificationsService))
    private readonly aiNotificationsService: AINotificationsService,
  ) {}

  async create(dto: any) {
    const now = Date.now();
    const priorityMap: Record<string, string> = {
      დაბალი: 'low',
      საშუალო: 'medium',
      მაღალი: 'high',
      სასწრაფო: 'high',
    };
    const urgency = priorityMap[dto?.urgency] || dto?.urgency || 'medium';
    const doc = new this.requestModel({
      ...dto,
      urgency,
      createdAt: now,
      updatedAt: now,
      status: 'active',
    });

    const savedRequest = await doc.save();

    // Send push notifications to relevant stores/dismantlers
    if ((dto as any).vehicle && (dto as any).partName && (dto as any).userId) {
      try {
        await this.notificationsService.sendRequestNotificationToRelevantStores({
          partName: (dto as any).partName,
          vehicle: (dto as any).vehicle,
          location: (dto as any).location,
          userId: (dto as any).userId,
          requestId: savedRequest._id?.toString(),
        });
        console.log(
          '📱 Push notifications sent for request:',
          savedRequest._id,
        );
      } catch (error) {
        console.error('❌ Failed to send push notifications:', error);
        // Don't fail the request creation if notifications fail
      }

      try {
        await this.aiNotificationsService.sendAIRecommendationNotification(
          (dto as any).userId,
          savedRequest,
        );
        console.log(
          '🤖 AI recommendation push sent for request:',
          savedRequest._id,
        );
      } catch (error) {
        console.error('❌ Failed to send AI recommendation push:', error);
      }
    }

    return savedRequest;
  }

  async findAll(userId?: string) {
    const filter: any = {};
    if (userId) filter.userId = userId;
    return this.requestModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    const doc = await this.requestModel.findById(id).exec();
    if (!doc) throw new NotFoundException('request_not_found');
    return doc;
  }

  async update(id: string, dto: any) {
    const doc = await this.requestModel
      .findByIdAndUpdate(id, { ...dto, updatedAt: Date.now() }, { new: true })
      .exec();
    if (!doc) throw new NotFoundException('request_not_found');
    return doc;
  }

  async remove(id: string) {
    const res = await this.requestModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('request_not_found');
    return { success: true };
  }
}
