import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FinancingRequest, FinancingRequestDocument } from './financing.schema';
import { FinancingLead, FinancingLeadDocument } from './financing.lead.schema';

@Injectable()
export class FinancingService {
  constructor(
    @InjectModel(FinancingRequest.name)
    private readonly financingRequestModel: Model<FinancingRequestDocument>,
    @InjectModel(FinancingLead.name)
    private readonly financingLeadModel: Model<FinancingLeadDocument>,
  ) {}
  apply(dto: {
    userId: string;
    requestId: string;
    amount: number;
    downPayment?: number;
    termMonths: number;
    personalId?: string;
    phone?: string;
  }) {
    // Mock scoring
    const approved =
      dto.amount <= 5000 || (dto.downPayment || 0) >= dto.amount * 0.2;
    return {
      applicationId: `fin_${Date.now()}`,
      status: approved ? 'pre_approved' : 'needs_review',
      monthlyEstimate: approved
        ? Math.round(
            (dto.amount - (dto.downPayment || 0)) / Math.max(1, dto.termMonths),
          )
        : null,
    };
  }

  async createRequest(dto: { fullName: string; phone: string; note?: string }) {
    const doc = await this.financingRequestModel.create({
      fullName: dto.fullName,
      phone: dto.phone,
      note: dto.note,
    });
    return {
      id: String(doc._id),
      fullName: doc.fullName,
      phone: doc.phone,
      note: doc.note ?? '',
      createdAt: doc.createdAt,
    };
  }

  async createLead(dto: {
    userId: string;
    requestId: string;
    amount: number;
    phone: string;
    merchantPhone?: string;
    downPayment?: number;
    termMonths?: number;
    personalId?: string;
    note?: string;
  }) {
    const doc = await this.financingLeadModel.create(dto);
    return {
      id: String(doc._id),
      status: 'received',
      createdAt: new Date().toISOString(),
    };
  }

  async findAllLeads(limit = 200) {
    const docs = await this.financingLeadModel
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<
        {
          _id: unknown;
          userId: string;
          requestId: string;
          amount: number;
          phone: string;
          merchantPhone: string;
          downPayment?: number;
          termMonths?: number;
          personalId?: string;
          note?: string;
          createdAt: Date;
        }[]
      >();
    return docs.map((d) => ({
      id: String(d._id as any),
      userId: d.userId,
      requestId: d.requestId,
      amount: d.amount,
      phone: d.phone,
      merchantPhone: d.merchantPhone ?? null,
      downPayment: d.downPayment ?? null,
      termMonths: d.termMonths ?? null,
      personalId: d.personalId ?? null,
      note: d.note ?? '',
      createdAt: d.createdAt,
    }));
  }
}
