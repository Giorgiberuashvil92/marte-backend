import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  InsuranceLead,
  InsuranceLeadDocument,
} from '../schemas/insurance-lead.schema';

export type CreateInsuranceLeadInput = {
  firstName: string;
  lastName: string;
  personalId: string;
  phone: string;
  email: string;
  userId?: string;
  productType: string;
  planKey?: string;
  planLabel?: string;
  priceMonthly?: number;
  priceYearly?: number;
  carInfo?: string;
  source?: string;
};

@Injectable()
export class InsuranceService {
  constructor(
    @InjectModel(InsuranceLead.name)
    private readonly model: Model<InsuranceLeadDocument>,
  ) {}

  async create(payload: CreateInsuranceLeadInput) {
    const doc = new this.model({
      firstName: payload.firstName,
      lastName: payload.lastName,
      personalId: payload.personalId,
      phone: payload.phone,
      email: payload.email,
      userId: payload.userId,
      productType: payload.productType,
      planKey: payload.planKey || '',
      planLabel: payload.planLabel || '',
      priceMonthly: payload.priceMonthly ?? 0,
      priceYearly: payload.priceYearly ?? 0,
      carInfo: payload.carInfo || '',
      source: payload.source || 'insurance_screen',
    });
    return doc.save();
  }

  private serializeRow(doc: Record<string, unknown>) {
    const row = { ...doc } as Record<string, unknown>;
    for (const key of ['createdAt', 'updatedAt'] as const) {
      const v = row[key];
      if (v instanceof Date) {
        row[key] = v.toISOString();
      }
    }
    return row;
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

    return {
      data: data.map((d) => this.serializeRow(d as Record<string, unknown>)),
      total,
      limit,
      offset,
    };
  }

  async updateById(
    id: string,
    patch: { adminNote?: string; called?: boolean },
  ) {
    const $set: Record<string, unknown> = {};
    if (patch.adminNote !== undefined) {
      $set.adminNote = String(patch.adminNote);
    }
    if (patch.called !== undefined) {
      $set.called = Boolean(patch.called);
    }
    if (Object.keys($set).length === 0) {
      const existing = await this.model.findById(id).lean().exec();
      return existing
        ? this.serializeRow(existing as Record<string, unknown>)
        : null;
    }

    const updated = await this.model
      .findByIdAndUpdate(id, { $set }, { new: true })
      .lean()
      .exec();
    return updated
      ? this.serializeRow(updated as Record<string, unknown>)
      : null;
  }
}
