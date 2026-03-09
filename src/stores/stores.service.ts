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
    // eslint-disable-next-line prettier/prettier
    
    // გამოვთვალოთ expiry date (1 თვე შექმნის თარიღიდან)
    const expiryDate = new Date(now);
    expiryDate.setMonth(expiryDate.getMonth() + 1);

    const storeData = {
      ...createStoreDto,
      status: createStoreDto.status || 'pending',
      nextPaymentDate: createStoreDto.nextPaymentDate
        ? new Date(createStoreDto.nextPaymentDate)
        : nextPaymentDate,
      paymentStatus: createStoreDto.paymentStatus || 'pending',
      totalPaid: createStoreDto.totalPaid || 0,
      isFeatured: false,
      isVip: createStoreDto.isVip === true,
      expiryDate: expiryDate,
    };
    const createdStore = new this.storeModel(storeData);
    return createdStore.save();
  }

  async findAll(
    ownerId?: string,
    location?: string,
    includeAll: boolean = false,
    type?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<Store[]> {
    console.log('🔍 [STORES SERVICE] findAll called with:', {
      ownerId,
      location,
      includeAll,
      type,
      page,
      limit,
    });
    const filter: Record<string, any> = {};
    if (ownerId) {
      filter.ownerId = ownerId;
    } else if (!includeAll) {
      filter.status = 'active';
    }
    if (location) filter.location = location;
    if (type) {
      console.log('🔍 [STORES SERVICE] Filtering by type:', type);
      filter.type = type;
    }
    const query = this.storeModel.find(filter).sort({ createdAt: -1 });
    if (!ownerId) {
      const skip = (page - 1) * limit;
      query.skip(skip).limit(limit);
    }
    const stores = await query.exec();
    console.log('🔍 [STORES SERVICE] Found stores:', stores.length);
    if (stores.length > 0 && type) {
      console.log(
        '🔍 [STORES SERVICE] Store types found:',
        stores.map((s) => s.type),
      );
    }

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

  async renew(id: string): Promise<Store> {
    const store = await this.storeModel.findById(id).exec();
    if (!store) {
      throw new NotFoundException('მაღაზია ვერ მოიძებნა');
    }

    // განვაახლოთ expiry date (1 თვე ახლიდან)
    const newExpiryDate = new Date();
    newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);

    // ასევე განვაახლოთ nextPaymentDate
    const newNextPaymentDate = new Date();
    newNextPaymentDate.setMonth(newNextPaymentDate.getMonth() + 1);

    const updatedStore = await this.storeModel
      .findByIdAndUpdate(
        id,
        {
          expiryDate: newExpiryDate,
          nextPaymentDate: newNextPaymentDate,
          paymentStatus: 'paid',
          updatedAt: new Date(),
        },
        { new: true },
      )
      .exec();

    if (!updatedStore) {
      throw new NotFoundException('მაღაზია ვერ მოიძებნა');
    }

    return updatedStore;
  }
}
