import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Store, StoreDocument } from '../schemas/store.schema';

@Injectable()
export class StoresService {
  constructor(
    @InjectModel(Store.name) private readonly storeModel: Model<StoreDocument>,
  ) {}

  async create(dto: any) {
    const now = Date.now();
    const doc = new this.storeModel({
      ...dto,
      createdAt: now,
      updatedAt: now,
    });
    return doc.save();
  }

  async findAll(ownerId?: string) {
    const filter: any = {};
    if (ownerId) filter.ownerId = ownerId;
    return this.storeModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    const doc = await this.storeModel.findById(id).exec();
    if (!doc) throw new NotFoundException('store_not_found');
    return doc;
  }

  async update(id: string, dto: any) {
    const doc = await this.storeModel
      .findByIdAndUpdate(id, { ...dto, updatedAt: Date.now() }, { new: true })
      .exec();
    if (!doc) throw new NotFoundException('store_not_found');
    return doc;
  }

  async remove(id: string) {
    const res = await this.storeModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('store_not_found');
    return { success: true };
  }
}
