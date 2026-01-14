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
    // ახალი მაღაზია იქმნება pending status-ით (თუ status არ არის მითითებული)
    // შემდეგი გადახდის თარიღი ავტომატურად იქნება შექმნის თარიღის შემდეგ 1 თვეში
    const now = new Date();
    const nextPaymentDate = new Date(now);
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

    const storeData = {
      ...createStoreDto,
      status: createStoreDto.status || 'pending',
      nextPaymentDate: createStoreDto.nextPaymentDate
        ? new Date(createStoreDto.nextPaymentDate)
        : nextPaymentDate,
      paymentStatus: createStoreDto.paymentStatus || 'pending',
      totalPaid: createStoreDto.totalPaid || 0,
    };
    const createdStore = new this.storeModel(storeData);
    return createdStore.save();
  }

  async findAll(
    ownerId?: string,
    location?: string,
    includeAll: boolean = false,
  ): Promise<Store[]> {
    const filter: Record<string, any> = {};
    if (ownerId) {
      // თუ ownerId არის მითითებული (პარტნიორის დეშბორდი), ყველა მაღაზია ჩანდეს
      filter.ownerId = ownerId;
    } else if (!includeAll) {
      // თუ ownerId არ არის მითითებული და includeAll არ არის true (ზოგადი სია), მხოლოდ active მაღაზიები ჩანდეს
      filter.status = 'active';
    }
    // თუ includeAll არის true (admin panel), ყველა მაღაზია ჩანდეს (ყველა status-ით)
    if (location) filter.location = location;
    const stores = await this.storeModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();

    // ავტომატურად განვაახლოთ paymentStatus თუ nextPaymentDate გავიდა
    const now = new Date();
    for (const store of stores) {
      if (
        store.nextPaymentDate &&
        new Date(store.nextPaymentDate) < now &&
        store.paymentStatus !== 'overdue'
      ) {
        await this.storeModel.findByIdAndUpdate(store._id, {
          paymentStatus: 'overdue',
        });
        store.paymentStatus = 'overdue';
      }
    }

    return stores;
  }

  async findOne(id: string): Promise<Store> {
    const store = await this.storeModel.findById(id).exec();
    if (!store) throw new NotFoundException('მაღაზია ვერ მოიძებნა');

    // ავტომატურად განვაახლოთ paymentStatus თუ nextPaymentDate გავიდა
    const now = new Date();
    if (
      store.nextPaymentDate &&
      new Date(store.nextPaymentDate) < now &&
      store.paymentStatus !== 'overdue'
    ) {
      const updated = await this.storeModel.findByIdAndUpdate(
        id,
        { paymentStatus: 'overdue' },
        { new: true },
      );
      return updated || store;
    }

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

  async getLocations(): Promise<string[]> {
    // მხოლოდ active მაღაზიების locations-ები
    const stores = await this.storeModel
      .find({
        location: { $exists: true, $ne: '' },
        status: 'active',
      })
      .exec();
    const locations = stores
      .map((store) => store.location)
      .filter((loc) => loc && loc.trim() !== '');
    // Return unique locations, sorted alphabetically
    return Array.from(new Set(locations)).sort();
  }
}
