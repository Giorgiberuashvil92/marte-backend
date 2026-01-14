import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Store, StoreDocument } from '../schemas/store.schema';
import { CreateStoreDto } from '../stores/dto/create-store.dto';
import { UpdateStoreDto } from '../stores/dto/update-store.dto';

@Injectable()
export class DetailingService {
  constructor(
    @InjectModel(Store.name) private readonly storeModel: Model<StoreDocument>,
  ) {}

  async create(createStoreDto: CreateStoreDto): Promise<Store> {
    // ახალი detailing მაღაზია იქმნება pending status-ით
    const now = new Date();
    const nextPaymentDate = new Date(now);
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

    const storeData = {
      ...createStoreDto,
      type: 'დითეილინგი', // Force detailing type
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
    const filter: Record<string, any> = {
      $or: [{ type: 'დითეილინგი' }, { type: 'სხვა' }], // Backward compatibility
    };

    if (ownerId) {
      filter.ownerId = ownerId;
    } else if (!includeAll) {
      filter.status = 'active';
    }

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
    const store = await this.storeModel
      .findOne({
        _id: id,
        $or: [{ type: 'დითეილინგი' }, { type: 'სხვა' }],
      })
      .exec();

    if (!store) throw new NotFoundException('დითეილინგ მაღაზია ვერ მოიძებნა');

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
    // Ensure it's a detailing store
    const existing = await this.findOne(id);
    if (!existing)
      throw new NotFoundException('დითეილინგ მაღაზია ვერ მოიძებნა');

    const updatedStore = await this.storeModel
      .findByIdAndUpdate(
        id,
        { ...updateStoreDto, type: 'დითეილინგი' },
        { new: true },
      )
      .exec();
    if (!updatedStore)
      throw new NotFoundException('დითეილინგ მაღაზია ვერ მოიძებნა');
    return updatedStore;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findOne(id);
    if (!existing)
      throw new NotFoundException('დითეილინგ მაღაზია ვერ მოიძებნა');

    const result = await this.storeModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('დითეილინგ მაღაზია ვერ მოიძებნა');
  }

  async getLocations(): Promise<string[]> {
    const stores = await this.storeModel
      .find({
        $or: [{ type: 'დითეილინგი' }, { type: 'სხვა' }],
        location: { $exists: true, $ne: '' },
        status: 'active',
      })
      .exec();
    const locations = stores
      .map((store) => store.location)
      .filter((loc) => loc && loc.trim() !== '');
    return Array.from(new Set(locations)).sort();
  }
}
