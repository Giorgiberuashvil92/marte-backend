import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DriverAlert, DriverAlertDocument } from '../schemas/driver-alert.schema';

@Injectable()
export class DriverAlertsService {
  constructor(@InjectModel(DriverAlert.name) private readonly model: Model<DriverAlertDocument>) {}

  async list(limit = 20) {
    return this.model.find({ isActive: true }).sort({ createdAt: -1 }).limit(Math.min(Math.max(limit, 1), 50)).lean();
  }

  async create(payload: Partial<DriverAlert>) {
    return this.model.create({ ...payload, isActive: true });
  }
}
