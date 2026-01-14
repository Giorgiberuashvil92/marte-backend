import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SpecialOffer,
  SpecialOfferDocument,
} from '../schemas/special-offer.schema';

@Injectable()
export class SpecialOffersService {
  constructor(
    @InjectModel(SpecialOffer.name)
    private specialOfferModel: Model<SpecialOfferDocument>,
  ) {}

  async create(payload: {
    storeId: string;
    discount: string;
    oldPrice: string;
    newPrice: string;
    title?: string;
    description?: string;
    image?: string;
    isActive?: boolean;
    startDate?: Date;
    endDate?: Date;
    priority?: number;
    createdBy?: string;
  }) {
    const offer = new this.specialOfferModel({
      ...payload,
      isActive: payload.isActive ?? true,
      priority: payload.priority ?? 0,
    });
    return offer.save();
  }

  async findAll(activeOnly = true) {
    const filter: any = {};

    if (activeOnly) {
      filter.isActive = true;
      const now = new Date();
      filter.$or = [
        { startDate: { $exists: false } },
        { startDate: { $lte: now } },
      ];
      filter.$and = [
        {
          $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }],
        },
      ];
    }

    return this.specialOfferModel
      .find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .lean()
      .exec();
  }

  async findByStoreId(storeId: string, activeOnly = true) {
    const filter: any = { storeId };

    if (activeOnly) {
      filter.isActive = true;
      const now = new Date();
      filter.$or = [
        { startDate: { $exists: false } },
        { startDate: { $lte: now } },
      ];
      filter.$and = [
        {
          $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }],
        },
      ];
    }

    return this.specialOfferModel
      .find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .lean()
      .exec();
  }

  async findOne(id: string) {
    const offer = await this.specialOfferModel.findById(id).lean();
    if (!offer) {
      throw new NotFoundException('Special offer not found');
    }
    return offer;
  }

  async update(id: string, updates: Partial<SpecialOffer>) {
    // updatedAt will be automatically updated by mongoose timestamps: true
    const updated = await this.specialOfferModel
      .findByIdAndUpdate(id, updates, { new: true })
      .lean();
    if (!updated) {
      throw new NotFoundException('Special offer not found');
    }
    return updated;
  }

  async delete(id: string) {
    const deleted = await this.specialOfferModel.findByIdAndDelete(id).lean();
    if (!deleted) {
      throw new NotFoundException('Special offer not found');
    }
    return deleted;
  }

  async toggleActive(id: string) {
    const offer = await this.specialOfferModel.findById(id);
    if (!offer) {
      throw new NotFoundException('Special offer not found');
    }
    offer.isActive = !offer.isActive;
    // updatedAt will be automatically updated by mongoose timestamps: true
    return offer.save();
  }
}
