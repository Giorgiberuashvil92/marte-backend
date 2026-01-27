import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Request, RequestDocument } from '../schemas/request.schema';
import { User } from '../schemas/user.schema';
import { Offer, OfferDocument } from '../schemas/offer.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { AINotificationsService } from '../ai/ai-notifications.service';

@Injectable()
export class RequestsService {
  constructor(
    @InjectModel(Request.name)
    private readonly requestModel: Model<RequestDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(Offer.name)
    private readonly offerModel: Model<OfferDocument>,
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
    if (dto.vehicle && dto.partName && dto.userId) {
      try {
        await this.notificationsService.sendRequestNotificationToRelevantStores(
          {
            partName: dto.partName,
            vehicle: dto.vehicle,
            location: dto.location,
            userId: dto.userId,
            requestId: savedRequest._id?.toString(),
          },
        );
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
          dto.userId,
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
    const requests = await this.requestModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean();

    // Enrich with user info and offers count
    const userIds = Array.from(
      new Set(requests.map((r: any) => r.userId).filter(Boolean)),
    );
    const requestIds = requests
      .map((r: any) => r._id?.toString() || r.id)
      .filter(Boolean);

    // Fetch users
    const objectIds = userIds
      .filter((v) => Types.ObjectId.isValid(v))
      .map((v) => new Types.ObjectId(v));
    const customIds = userIds.filter((v) => !Types.ObjectId.isValid(v));

    const users = userIds.length
      ? await this.userModel
          .find({
            $or: [
              ...(customIds.length ? [{ id: { $in: customIds } }] : []),
              ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
            ],
          })
          .lean()
      : [];

    const userMap = new Map();
    users.forEach((u: any) => {
      if (u.id) userMap.set(u.id, u);
      if (u._id) userMap.set(String(u._id), u);
    });

    // Fetch offers count
    const offersCounts = await this.offerModel
      .aggregate([
        { $match: { reqId: { $in: requestIds } } },
        { $group: { _id: '$reqId', count: { $sum: 1 } } },
      ])
      .exec();

    const offersCountMap = new Map();
    offersCounts.forEach((item: any) => {
      offersCountMap.set(String(item._id), item.count);
    });

    // Enrich requests
    return requests.map((req: any) => {
      const user = userMap.get(req.userId) || userMap.get(String(req.userId));
      const offersCount =
        offersCountMap.get(String(req._id)) || offersCountMap.get(req.id) || 0;

      const userName = user
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
          user.email ||
          user.phone ||
          'მომხმარებელი'
        : 'მომხმარებელი';

      return {
        ...req,
        id: req.id || (req._id ? String(req._id) : ''),
        userName,
        userPhone: user?.phone,
        offersCount,
      };
    });
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

  async addResponse(requestId: string, responseData: any) {
    const request = await this.requestModel.findById(requestId).exec();
    if (!request) throw new NotFoundException('request_not_found');

    const response = {
      responderId: responseData.responderId,
      responderName: responseData.responderName,
      responderPhone: responseData.responderPhone,
      responderEmail: responseData.responderEmail,
      message: responseData.message,
      price: responseData.price,
      timestamp: Date.now(),
    };

    request.responses = request.responses || [];
    request.responses.push(response as any);
    request.set('updatedAt', Date.now());

    return await request.save();
  }

  async addMessage(requestId: string, messageData: any) {
    const request = await this.requestModel.findById(requestId).exec();
    if (!request) throw new NotFoundException('request_not_found');

    const message = {
      responderId: messageData.responderId,
      responderName: messageData.responderName,
      responderPhone: messageData.responderPhone,
      responderEmail: messageData.responderEmail,
      message: messageData.message,
      price: messageData.price,
      timestamp: Date.now(),
    };

    request.messages = request.messages || [];
    request.messages.push(message as any);
    request.set('updatedAt', Date.now());

    return await request.save();
  }

  async getResponses(requestId: string) {
    const request = await this.requestModel.findById(requestId).exec();
    if (!request) throw new NotFoundException('request_not_found');
    return request.responses || [];
  }

  async getMessages(requestId: string) {
    const request = await this.requestModel.findById(requestId).exec();
    if (!request) throw new NotFoundException('request_not_found');
    return request.messages || [];
  }

  async getOffers(requestId: string) {
    // Verify request exists
    const request = await this.requestModel.findById(requestId).exec();
    if (!request) throw new NotFoundException('request_not_found');

    // Get offers for this request
    const offers = await this.offerModel
      .find({ reqId: requestId })
      .sort({ createdAt: -1 })
      .lean();

    return offers.map((offer: any) => ({
      ...offer,
      id: offer.id || (offer._id ? String(offer._id) : ''),
    }));
  }
}
