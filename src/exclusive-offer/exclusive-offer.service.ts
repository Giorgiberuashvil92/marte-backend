import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ExclusiveOfferRequest,
  ExclusiveOfferRequestDocument,
} from '../schemas/exclusive-offer-request.schema';

@Injectable()
export class ExclusiveOfferService {
  constructor(
    @InjectModel(ExclusiveOfferRequest.name)
    private readonly model: Model<ExclusiveOfferRequestDocument>,
  ) {}

  async create(payload: {
    firstName: string;
    lastName: string;
    personalId: string;
    phone: string;
    email: string;
    userId?: string;
    source?: string;
  }) {
    const doc = new this.model({
      firstName: payload.firstName,
      lastName: payload.lastName,
      personalId: payload.personalId,
      phone: payload.phone,
      email: payload.email,
      userId: payload.userId,
      source: payload.source || 'fuel_exclusive_portal',
    });
    return doc.save();
  }

  async list(params?: { limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(params?.limit ?? 50, 1), 200);
    const offset = Math.max(params?.offset ?? 0, 0);

    const [data, total] = await Promise.all([
      this.model
        .find({})
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments().exec(),
    ]);

    return { data, total, limit, offset };
  }
}
