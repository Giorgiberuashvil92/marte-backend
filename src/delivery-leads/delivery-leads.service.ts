import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DeliveryLead,
  DeliveryLeadDocument,
} from '../schemas/delivery-lead.schema';

@Injectable()
export class DeliveryLeadsService {
  constructor(
    @InjectModel(DeliveryLead.name)
    private readonly deliveryLeadModel: Model<DeliveryLeadDocument>,
  ) {}

  async create(dto: Partial<DeliveryLead>) {
    const lead = new this.deliveryLeadModel(dto);
    return lead.save();
  }

  async list(options: {
    limit?: number;
    offset?: number;
    status?: string;
    userId?: string;
  }) {
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
    const offset = Math.max(Number(options.offset) || 0, 0);
    const filter: Record<string, unknown> = {};
    if (options.status) filter.status = options.status;
    if (options.userId) filter.userId = options.userId;

    const [data, total] = await Promise.all([
      this.deliveryLeadModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      this.deliveryLeadModel.countDocuments(filter),
    ]);

    return { data, total, limit, offset };
  }

  async update(id: string, dto: Partial<DeliveryLead>) {
    return this.deliveryLeadModel
      .findByIdAndUpdate(id, dto, { new: true })
      .lean();
  }
}
