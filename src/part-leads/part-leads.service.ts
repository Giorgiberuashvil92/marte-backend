import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PartLead, PartLeadDocument } from '../schemas/part-lead.schema';

type CreatePartLeadInput = Partial<PartLead> & {
  partId?: string;
  partTitle?: string;
};

@Injectable()
export class PartLeadsService {
  constructor(
    @InjectModel(PartLead.name)
    private readonly partLeadModel: Model<PartLeadDocument>,
  ) {}

  async create(dto: CreatePartLeadInput) {
    const partId = this.clean(dto.partId);
    const partTitle = this.clean(dto.partTitle);

    if (!partId || !partTitle) {
      return { success: false, error: 'part_required' };
    }

    const created = await this.partLeadModel.create({
      userId: this.clean(dto.userId) || undefined,
      userName: this.clean(dto.userName),
      userPhone: this.clean(dto.userPhone),
      partId,
      partTitle,
      partPrice: this.clean(dto.partPrice),
      partBrand: this.clean(dto.partBrand),
      partModel: this.clean(dto.partModel),
      partCategory: this.clean(dto.partCategory),
      partLocation: this.clean(dto.partLocation),
      partImage: this.clean(dto.partImage),
      note: this.clean(dto.note),
      source: this.clean(dto.source) || 'parts_detail',
      status: 'new',
    });

    return { success: true, data: created.toJSON() };
  }

  async list(options: {
    limit?: number;
    offset?: number;
    status?: string;
    userId?: string;
    partId?: string;
  }) {
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
    const offset = Math.max(Number(options.offset) || 0, 0);
    const filter: Record<string, unknown> = {};
    if (options.status) filter.status = options.status;
    if (options.userId) filter.userId = options.userId;
    if (options.partId) filter.partId = options.partId;

    const [data, total] = await Promise.all([
      this.partLeadModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      this.partLeadModel.countDocuments(filter),
    ]);

    return { success: true, data, total, limit, offset };
  }

  async updateStatus(id: string, status: string) {
    if (!['new', 'contacted', 'closed'].includes(status)) {
      return { success: false, error: 'status_invalid' };
    }

    const updated = await this.partLeadModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .lean();

    return { success: true, data: updated };
  }

  private clean(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
