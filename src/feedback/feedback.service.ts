import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Feedback, FeedbackDocument } from '../schemas/feedback.schema';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel(Feedback.name) private feedbackModel: Model<FeedbackDocument>,
  ) {}

  async create(payload: {
    message: string;
    userId?: string;
    userName?: string;
    phone?: string;
    source?: string;
  }) {
    console.log('📝 [FEEDBACK_SERVICE] Creating feedback with payload:', payload);
    const doc = new this.feedbackModel(payload);
    const saved = await doc.save();
    console.log('✅ [FEEDBACK_SERVICE] Feedback saved:', saved);
    return saved;
  }

  async list(params?: { limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(params?.limit ?? 50, 1), 200);
    const offset = Math.max(params?.offset ?? 0, 0);

    const [data, total] = await Promise.all([
      this.feedbackModel
        .find({})
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean()
        .exec(),
      this.feedbackModel.countDocuments().exec(),
    ]);

    return { data, total, limit, offset };
  }
}
