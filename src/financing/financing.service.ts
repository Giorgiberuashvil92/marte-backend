import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FinancingRequest, FinancingRequestDocument } from './financing.schema';

@Injectable()
export class FinancingService {
  constructor(
    @InjectModel(FinancingRequest.name)
    private readonly financingRequestModel: Model<FinancingRequestDocument>,
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
}
