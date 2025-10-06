import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Store, StoreDocument } from '../schemas/store.schema';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@Injectable()
export class StoresService {
  constructor(
    @InjectModel(Store.name) private readonly storeModel: Model<StoreDocument>,
  ) {}

  async create(createStoreDto: CreateStoreDto): Promise<Store> {
    const createdStore = new this.storeModel(createStoreDto);
    return createdStore.save();
  }

  async findAll(ownerId?: string): Promise<Store[]> {
    const filter: Record<string, any> = {};
    if (ownerId) filter.ownerId = ownerId;
    return this.storeModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<Store> {
    const store = await this.storeModel.findById(id).exec();
    if (!store) throw new NotFoundException('მაღაზია ვერ მოიძებნა');
    return store;
  }

  async update(id: string, updateStoreDto: UpdateStoreDto): Promise<Store> {
    const updatedStore = await this.storeModel
      .findByIdAndUpdate(id, updateStoreDto, { new: true })
      .exec();
    if (!updatedStore) throw new NotFoundException('მაღაზია ვერ მოიძებნა');
    return updatedStore;
  }

  async remove(id: string): Promise<void> {
    const result = await this.storeModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('მაღაზია ვერ მოიძებნა');
  }
}
