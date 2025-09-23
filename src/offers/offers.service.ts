import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Offer, OfferDocument } from '../schemas/offer.schema';
import { OffersGateway } from './offers.gateway';

@Injectable()
export class OffersService {
  constructor(
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    private readonly gateway?: OffersGateway,
  ) {}

  async create(dto: any) {
    const now = Date.now();
    const doc = new this.offerModel({
      ...dto,
      createdAt: now,
      updatedAt: now,
      status: dto?.status || 'pending',
    });
    const saved = await doc.save();
    if (this.gateway && saved?.reqId) {
      this.gateway.emitOfferNew(String(saved.reqId), saved.toJSON());
    }
    return saved;
  }

  async findAll(reqId?: string, userId?: string, partnerId?: string) {
    const filter: any = {};
    if (reqId) filter.reqId = reqId;
    if (userId) filter.userId = userId;
    if (partnerId) filter.partnerId = partnerId;
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
    return doc;
  }

  async remove(id: string) {
    const res = await this.offerModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('offer_not_found');
    return { success: true };
  }
}
