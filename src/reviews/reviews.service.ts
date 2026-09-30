import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Review, ReviewDocument } from './reviews.schema';

@Injectable()
export class ReviewsService {
  constructor(@InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>) {}

  async create(payload: Partial<Review>) {
    return new this.reviewModel(payload).save();
  }

  async list(params?: { limit?: number; offset?: number; source?: string }) {
    const limit = Math.min(Math.max(params?.limit ?? 50, 1), 200);
    const offset = Math.max(params?.offset ?? 0, 0);
    const query = params?.source ? { source: params.source } : {};
    const [data, total] = await Promise.all([
      this.reviewModel.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).lean().exec(),
      this.reviewModel.countDocuments(query).exec(),
    ]);
    return { data, total, limit, offset };
  }
}
