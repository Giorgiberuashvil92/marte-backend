import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Part, PartDocument } from '../schemas/part.schema';
import { CreatePartDto } from './dto/create-part.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { AINotificationsService } from '../ai/ai-notifications.service';

@Injectable()
export class PartsService {
  constructor(
    @InjectModel(Part.name) private partModel: Model<PartDocument>,
    @Inject(forwardRef(() => AINotificationsService))
    private aiNotificationsService: AINotificationsService,
  ) {}

  async create(createPartDto: CreatePartDto): Promise<Part> {
    const createdPart = new this.partModel(createPartDto);
    const savedPart = await createdPart.save();

    try {
      await this.aiNotificationsService.checkMatchingRequestsForNewPart(
        savedPart,
      );
    } catch (error) {
      console.error('❌ Error checking AI matches for new part:', error);
    }

    return savedPart;
  }

  async findAll(filters?: {
    category?: string;
    condition?: string;
    brand?: string;
    model?: string;
    location?: string;
    status?: string;
    priceRange?: { min: number; max: number };
  }): Promise<Part[]> {
    const query: Record<string, any> = {};

    if (filters?.category) {
      query.category = filters.category;
    }

    if (filters?.condition) {
      query.condition = filters.condition;
    }

    if (filters?.brand) {
      query.brand = filters.brand;
    }

    if (filters?.model) {
      query.model = filters.model;
    }

    if (filters?.location) {
      query.location = filters.location;
    }

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.priceRange) {
      query.price = {
        $gte: filters.priceRange.min,
        $lte: filters.priceRange.max,
      };
    }

    return this.partModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<Part> {
    const part = await this.partModel.findById(id).exec();
    if (!part) {
      throw new Error('ნაწილი ვერ მოიძებნა');
    }
    return part;
  }

  async update(id: string, updatePartDto: UpdatePartDto): Promise<Part> {
    const updatedPart = await this.partModel
      .findByIdAndUpdate(id, updatePartDto, { new: true })
      .exec();

    if (!updatedPart) {
      throw new Error('ნაწილი ვერ მოიძებნა');
    }

    return updatedPart;
  }

  async remove(id: string): Promise<void> {
    const result = await this.partModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new Error('ნაწილი ვერ მოიძებნა');
    }
  }

  async getFeatured(): Promise<Part[]> {
    // Return recent parts as featured
    return this.partModel
      .find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();
  }

  async searchByKeyword(keyword: string): Promise<Part[]> {
    const regex = new RegExp(keyword, 'i');
    return this.partModel
      .find({
        $or: [
          { title: regex },
          { description: regex },
          { brand: regex },
          { model: regex },
          { category: regex },
        ],
        status: 'active',
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getByCategory(category: string): Promise<Part[]> {
    return this.partModel
      .find({ category, status: 'active' })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getByBrand(brand: string): Promise<Part[]> {
    return this.partModel
      .find({ brand, status: 'active' })
      .sort({ createdAt: -1 })
      .exec();
  }
}
