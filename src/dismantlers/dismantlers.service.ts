import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateDismantlerDto } from './dto/create-dismantler.dto';
import { UpdateDismantlerDto } from './dto/update-dismantler.dto';
import { Dismantler, DismantlerDocument } from '../schemas/dismantler.schema';

@Injectable()
export class DismantlersService {
  constructor(
    @InjectModel(Dismantler.name)
    private dismantlerModel: Model<DismantlerDocument>,
  ) {}

  async create(createDismantlerDto: CreateDismantlerDto): Promise<Dismantler> {
    console.log('🔧 DismantlersService.create called');
    console.log('📋 Input data:', JSON.stringify(createDismantlerDto, null, 2));

    // Validate year range
    if (createDismantlerDto.yearFrom > createDismantlerDto.yearTo) {
      console.error(
        '❌ Year validation failed:',
        createDismantlerDto.yearFrom,
        '>',
        createDismantlerDto.yearTo,
      );
      throw new Error('წლიდან არ შეიძლება იყოს უფრო დიდი ვიდრე წლამდე');
    }

    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);

    const newDismantler = new this.dismantlerModel({
      brand: createDismantlerDto.brand,
      model: createDismantlerDto.model,
      yearFrom: createDismantlerDto.yearFrom,
      yearTo: createDismantlerDto.yearTo,
      photos: createDismantlerDto.photos || [],
      description: createDismantlerDto.description,
      location: createDismantlerDto.location,
      phone: createDismantlerDto.phone,
      name: createDismantlerDto.name,
      contactInfo: {
        name: createDismantlerDto.contactName || createDismantlerDto.name,
        email: createDismantlerDto.contactEmail || '',
      },
      status: 'pending',
      views: 0,
      isFeatured: false,
      isVip: createDismantlerDto.isVip || false,
      ownerId: createDismantlerDto.ownerId,
      expiryDate: expiryDate,
      ...(createDismantlerDto.bogCardToken && {
        bogCardToken: createDismantlerDto.bogCardToken,
      }), // BOG order_id recurring payments-ისთვის
    });

    try {
      console.log('🔥 Saving to MongoDB...');
      const savedDismantler = await newDismantler.save();
      console.log('✅ Successfully saved to MongoDB:', savedDismantler._id);
      return savedDismantler;
    } catch (error) {
      console.error('❌ Error creating dismantler:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'UNKNOWN',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error('დაშლილების განცხადების შენახვისას მოხდა შეცდომა');
    }
  }

  async findAll(filters?: {
    brand?: string;
    model?: string;
    yearFrom?: number;
    yearTo?: number;
    location?: string;
    status?: string;
    ownerId?: string;
    vip?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    items: Dismantler[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const query: Record<string, any> = {};

    if (filters?.brand) {
      query.brand = new RegExp(filters.brand, 'i');
    }
    if (filters?.model) {
      query.model = new RegExp(filters.model, 'i');
    }
    if (filters?.yearFrom) {
      query.yearTo = { $gte: filters.yearFrom };
    }
    if (filters?.yearTo) {
      query.yearFrom = { $lte: filters.yearTo };
    }
    if (filters?.location) {
      query.location = new RegExp(filters.location, 'i');
    }
    if (filters?.status) {
      query.status = filters.status;
    } else if (!filters?.ownerId) {
      // საჯარო სიაში — expired არ ჩანს; pending/approved/active ჩანს
      query.status = { $ne: 'expired' };
    }
    if (filters?.ownerId) {
      query.ownerId = filters.ownerId;
    }
    if (filters?.vip !== undefined) {
      query.isVip = filters.vip === true;
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.dismantlerModel
        .find(query)
        .sort({ isVip: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.dismantlerModel.countDocuments(query).exec(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      hasMore: skip + items.length < total,
    };
  }

  async getFeatured(): Promise<Dismantler[]> {
    return this.dismantlerModel
      .find({ isFeatured: true, status: 'approved' })
      .sort({ createdAt: -1 })
      .limit(6)
      .exec();
  }

  async searchByKeyword(keyword: string): Promise<Dismantler[]> {
    const searchRegex = new RegExp(keyword, 'i');
    return this.dismantlerModel
      .find({
        $or: [
          { brand: searchRegex },
          { model: searchRegex },
          { description: searchRegex },
          { location: searchRegex },
        ],
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getByBrand(brand: string): Promise<Dismantler[]> {
    return this.dismantlerModel
      .find({ brand: new RegExp(brand, 'i') })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<Dismantler> {
    const dismantler = await this.dismantlerModel.findById(id).exec();
    if (!dismantler) {
      throw new Error(`დაშლილები ID: ${id} ვერ მოიძებნა`);
    }
    return dismantler;
  }

  async update(
    id: string,
    updateDismantlerDto: UpdateDismantlerDto,
  ): Promise<Dismantler> {
    const updatedDismantler = await this.dismantlerModel
      .findByIdAndUpdate(id, updateDismantlerDto, { new: true })
      .exec();

    if (!updatedDismantler) {
      throw new Error(`დაშლილები ID: ${id} ვერ მოიძებნა`);
    }

    return updatedDismantler;
  }

  async remove(id: string): Promise<void> {
    const result = await this.dismantlerModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new Error(`დაშლილები ID: ${id} ვერ მოიძებნა`);
    }
  }

  async renew(id: string): Promise<Dismantler> {
    const dismantler = await this.dismantlerModel.findById(id).exec();
    if (!dismantler) {
      throw new Error(`დაშლილები ID: ${id} ვერ მოიძებნა`);
    }

    // განვაახლოთ expiry date (1 თვე ახლიდან)
    const newExpiryDate = new Date();
    newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);

    const updatedDismantler = await this.dismantlerModel
      .findByIdAndUpdate(
        id,
        { expiryDate: newExpiryDate, updatedAt: new Date() },
        { new: true },
      )
      .exec();

    if (!updatedDismantler) {
      throw new Error(`დაშლილები ID: ${id} ვერ მოიძებნა`);
    }

    return updatedDismantler;
  }
}
