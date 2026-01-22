import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Service, ServiceDocument } from '../schemas/service.schema';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class AutoServicesService {
  constructor(
    @InjectModel(Service.name) private serviceModel: Model<ServiceDocument>,
  ) {}

  async create(createServiceDto: CreateServiceDto): Promise<Service> {
    // გამოვთვალოთ expiry date (1 თვე შექმნის თარიღიდან)
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);

    const serviceData: any = {
      ...createServiceDto,
      isFeatured: createServiceDto.isFeatured || false,
      expiryDate: expiryDate,
    };

    const createdService = new this.serviceModel(serviceData);
    return createdService.save();
  }

  async findAll(filters?: {
    category?: string;
    location?: string;
    isOpen?: boolean;
    status?: string;
    ownerId?: string;
  }): Promise<Service[]> {
    const query: Record<string, any> = {};

    if (filters?.category) {
      // Use regex for case-insensitive matching and partial matching
      query.category = { $regex: filters.category, $options: 'i' };
    }

    if (filters?.location) {
      query.location = { $regex: filters.location, $options: 'i' };
    }

    if (filters?.isOpen !== undefined) {
      query.isOpen = filters.isOpen;
    }

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.ownerId) {
      query.ownerId = filters.ownerId;
    }

    return this.serviceModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<Service> {
    const service = await this.serviceModel.findById(id).exec();
    if (!service) {
      throw new Error('სერვისი ვერ მოიძებნა');
    }
    return service;
  }

  async update(
    id: string,
    updateServiceDto: UpdateServiceDto,
  ): Promise<Service> {
    const updatedService = await this.serviceModel
      .findByIdAndUpdate(id, updateServiceDto, { new: true })
      .exec();
    if (!updatedService) {
      throw new Error('სერვისი ვერ მოიძებნა');
    }
    return updatedService;
  }

  async remove(id: string): Promise<Service> {
    const deletedService = await this.serviceModel.findByIdAndDelete(id).exec();
    if (!deletedService) {
      throw new Error('სერვისი ვერ მოიძებნა');
    }
    return deletedService;
  }

  async findByOwner(ownerId: string): Promise<Service[]> {
    return this.serviceModel.find({ ownerId }).sort({ createdAt: -1 }).exec();
  }

  async search(keyword: string): Promise<Service[]> {
    return this.serviceModel
      .find({
        $or: [
          { name: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } },
          { category: { $regex: keyword, $options: 'i' } },
          { location: { $regex: keyword, $options: 'i' } },
        ],
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * აიღებს სერვისებს რომლებსაც აქვთ latitude და longitude
   * ეს მეთოდი გამოიყენება რუკაზე სერვისების ჩვენებისთვის
   */
  async findWithCoordinates(): Promise<Service[]> {
    return this.serviceModel
      .find({
        latitude: { $exists: true, $ne: null },
        longitude: { $exists: true, $ne: null },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async renew(id: string): Promise<Service> {
    const service = await this.serviceModel.findById(id).exec();
    if (!service) {
      throw new Error('სერვისი ვერ მოიძებნა');
    }

    // განვაახლოთ expiry date (1 თვე ახლიდან)
    const newExpiryDate = new Date();
    newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);

    const updatedService = await this.serviceModel
      .findByIdAndUpdate(
        id,
        { expiryDate: newExpiryDate, updatedAt: new Date() },
        { new: true },
      )
      .exec();

    if (!updatedService) {
      throw new Error('სერვისი ვერ მოიძებნა');
    }

    return updatedService;
  }
}
