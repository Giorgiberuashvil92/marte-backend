import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request, RequestDocument } from '../schemas/request.schema';

@Injectable()
export class RequestsService {
  constructor(
    @InjectModel(Request.name)
    private readonly requestModel: Model<RequestDocument>,
  ) {}

  async create(dto: any) {
    const now = Date.now();
    const priorityMap: Record<string, string> = {
      დაბალი: 'low',
      საშუალო: 'medium',
      მაღალი: 'high',
      სასწრაფო: 'high',
    };
    const urgency = priorityMap[dto?.urgency] || dto?.urgency || 'medium';
    const doc = new this.requestModel({
      ...dto,
      urgency,
      createdAt: now,
      updatedAt: now,
      status: 'active',
    });
    return doc.save();
  }

  async findAll(userId?: string) {
    const filter: any = {};
    if (userId) filter.userId = userId;
    return this.requestModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    const doc = await this.requestModel.findById(id).exec();
    if (!doc) throw new NotFoundException('request_not_found');
    return doc;
  }

  async update(id: string, dto: any) {
    const doc = await this.requestModel
      .findByIdAndUpdate(id, { ...dto, updatedAt: Date.now() }, { new: true })
      .exec();
    if (!doc) throw new NotFoundException('request_not_found');
    return doc;
  }

  async remove(id: string) {
    const res = await this.requestModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('request_not_found');
    return { success: true };
  }
}
