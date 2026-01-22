import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Offer, OfferDocument } from '../schemas/offer.schema';
import { Request, RequestDocument } from '../schemas/request.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { OffersGateway } from './offers.gateway';

@Injectable()
export class OffersService {
  constructor(
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectModel(Request.name)
    private readonly requestModel: Model<RequestDocument>,
    private readonly gateway?: OffersGateway,
    private readonly notificationsService?: NotificationsService,
  ) {}

  async create(dto: any) {
    const now = Date.now();

    // Auto-sync partnerId with userId if they're the same user
    const finalDto = { ...dto };
    if (dto.userId && !dto.partnerId) {
      finalDto.partnerId = dto.userId; // Same user is both user and partner
      console.log(
        '🔄 [OFFERS] Auto-syncing partnerId with userId:',
        dto.userId,
      );
    }

    const doc = new this.offerModel({
      ...finalDto,
      providerName:
        finalDto.providerName ||
        finalDto.storeName ||
        finalDto.provider ||
        'მაღაზია',
      createdAt: now,
      updatedAt: now,
      status: finalDto?.status || 'pending',
    });
    const saved = await doc.save();
    if (this.gateway && saved?.reqId) {
      this.gateway.emitOfferNew(String(saved.reqId), saved.toJSON());
    }
    // Push to request owner on new offer
    try {
      if (this.notificationsService && saved?.reqId) {
        // მოვძებნოთ request-ის owner-ის userId
        let requestOwnerUserId: string | null = null;
        let finalRequestId = String(saved.reqId || '');
        
        try {
          // სცადოთ _id-ით (ObjectId)
          let request = await this.requestModel.findById(saved.reqId).lean();

          // თუ ვერ ვიპოვეთ, სცადოთ id ველით (string)
          if (!request) {
            request = await this.requestModel
              .findOne({ id: saved.reqId })
              .lean();
          }

          if (request) {
            requestOwnerUserId = String(request.userId || '');
            // მოვიღოთ request-ის _id (ObjectId) როგორც string notification-ისთვის
            finalRequestId = (request as any)._id 
              ? String((request as any)._id) 
              : (request as any).id || saved.reqId;
            
            console.log('✅ [OFFERS] Found request owner userId:', {
              reqId: saved.reqId,
              requestOwnerUserId,
              requestUserId: request.userId,
              finalRequestId,
            });
          } else {
            console.warn('⚠️ [OFFERS] Request not found:', saved.reqId);
          }
        } catch (error) {
          console.error('❌ [OFFERS] Error finding request:', error);
        }

        // თუ request-ის owner-ის userId ვერ ვიპოვეთ, გამოვიყენოთ saved.userId (fallback)
        const targetUserId = requestOwnerUserId || saved?.userId;

        if (targetUserId) {
          const storeName =
            (saved as any).providerName ||
            (saved as any).storeName ||
            'მაღაზია';
          const price = (saved as any).priceGEL
            ? `${(saved as any).priceGEL}₾`
            : '';
          const part = (saved as any).partName
            ? ` • ${(saved as any).partName}`
            : '';

          console.log('📱 [OFFERS] Sending notification to request owner:', {
            requestId: finalRequestId,
            reqId: saved.reqId,
            requestOwnerUserId,
            targetUserId,
            partnerId: saved.partnerId,
            savedUserId: saved.userId,
          });

          await this.notificationsService.sendPushToTargets(
            [{ userId: String(targetUserId) }],
            {
              title: '✨ ახალი შეთავაზება',
              body: `${storeName}${price ? ' • ' + price : ''}${part}`,
              data: {
                type: 'new_offer',
                screen: 'RequestDetails',
                requestId: finalRequestId,
                offerId: String((saved as any).id || saved._id || ''),
                storeName,
              },
              sound: 'default',
              badge: 1,
            },
            'offer',
          );
        } else {
          console.warn('⚠️ [OFFERS] No target userId found for notification:', {
            reqId: saved.reqId,
            savedUserId: saved.userId,
            requestOwnerUserId,
          });
        }
      }
    } catch (error) {
      console.error('❌ [OFFERS] Error sending notification:', error);
    }
    return saved;
  }

  async findAll(
    reqId?: string,
    userId?: string,
    partnerId?: string,
    reminderType?: string,
  ) {
    const filter: any = {};
    if (reqId) filter.reqId = reqId;
    if (userId) filter.userId = userId;
    if (partnerId) filter.partnerId = partnerId;
    if (reminderType) filter.reminderType = reminderType;
    return this.offerModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    const doc = await this.offerModel.findById(id).exec();
    if (!doc) throw new NotFoundException('offer_not_found');
    return doc;
  }

  async update(id: string, dto: any) {
    const doc = await this.offerModel
      .findByIdAndUpdate(id, { ...dto, updatedAt: Date.now() }, { new: true })
      .exec();
    if (!doc) throw new NotFoundException('offer_not_found');
    if (this.gateway && doc?.reqId) {
      this.gateway.emitOfferUpdate(String(doc.reqId), doc.toJSON());
    }

    // Push on status changes
    try {
      if (dto?.status === 'accepted' || dto?.status === 'rejected') {
        const title =
          dto.status === 'accepted'
            ? '✅ შეთავაზება მიღებულია'
            : '❌ შეთავაზება უარყოფილია';
        const body = `${doc.providerName} • ფასი: ${doc.priceGEL}₾`;
        const partnerUserId = doc.partnerId; // offer owner (partner)
        if (partnerUserId && this.notificationsService) {
          await this.notificationsService.sendPushToTargets(
            [{ userId: String(partnerUserId) }],
            {
              title,
              body,
              data: {
                type: 'offer_status',
                status: dto.status,
                requestId: doc.reqId,
                screen: 'OfferDetails',
              },
              sound: 'default',
              badge: 1,
            },
            'offer',
          );
        }
      }
    } catch {}
    return doc;
  }

  async remove(id: string) {
    const res = await this.offerModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('offer_not_found');
    return { success: true };
  }
}
