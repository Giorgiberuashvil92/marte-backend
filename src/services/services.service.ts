import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CarwashLocation } from '../schemas/carwash-location.schema';
import { Store } from '../schemas/store.schema';
import { Dismantler } from '../schemas/dismantler.schema';
import { Part } from '../schemas/part.schema';
import { Category } from '../schemas/category.schema';
import { Service } from '../schemas/service.schema';

export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  type: 'carwash' | 'store' | 'dismantler' | 'part' | 'category';
  location?: string;
  price?: string | number;
  images?: string[];
  phone?: string;
  rating?: number;
  reviews?: number;
  createdAt: Date;
  updatedAt: Date;
  popularity?: number;
  isOpen?: boolean;
  category?: string;
}

export interface MapServiceItem {
  id: string;
  title: string;
  description: string;
  type: 'carwash' | 'store' | 'service' | 'mechanic';
  location?: string;
  address?: string;
  price?: string | number;
  images?: string[];
  phone?: string;
  rating?: number;
  reviews?: number;
  latitude: number;
  longitude: number;
  isOpen?: boolean;
  category?: string;
  // დამატებითი ველები სხვადასხვა ტიპის სერვისებისთვის
  services?: string[];
  workingHours?: string;
  waitTime?: string;
  features?: string;
  name?: string;
  specialty?: string;
  experience?: string;
  avatar?: string;
  isAvailable?: boolean;
}

export interface GetAllServicesOptions {
  sortBy: 'date' | 'popularity';
  order: 'asc' | 'desc';
  limit: number;
  type?: string;
}

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    @InjectModel(CarwashLocation.name)
    private readonly carwashModel: Model<CarwashLocation>,
    @InjectModel(Store.name)
    private readonly storeModel: Model<Store>,
    @InjectModel(Dismantler.name)
    private readonly dismantlerModel: Model<Dismantler>,
    @InjectModel(Part.name)
    private readonly partModel: Model<Part>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<Category>,
    @InjectModel(Service.name)
    private readonly serviceModel: Model<Service>,
  ) {}

  async getAllServices(options: GetAllServicesOptions): Promise<ServiceItem[]> {
    const { sortBy, order, limit, type } = options;

    this.logger.log(
      `🔍 Fetching all services - sortBy: ${sortBy}, order: ${order}, type: ${type || 'all'}`,
    );

    const allServices: ServiceItem[] = [];

    try {
      // Parallel queries for better performance
      const promises: Promise<ServiceItem[]>[] = [];

      if (!type || type === 'carwash') {
        promises.push(this.getCarwashServices());
      }
      if (!type || type === 'store') {
        promises.push(this.getStoreServices());
      }
      if (!type || type === 'dismantler') {
        promises.push(this.getDismantlerServices());
      }
      if (!type || type === 'part') {
        promises.push(this.getPartServices());
      }
      if (!type || type === 'category') {
        promises.push(this.getCategoryServices());
      }

      const results = await Promise.all(promises);

      // Flatten all results
      results.forEach((serviceArray) => {
        allServices.push(...serviceArray);
      });

      // Sort based on criteria
      if (sortBy === 'date') {
        allServices.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return order === 'desc' ? dateB - dateA : dateA - dateB;
        });
      } else if (sortBy === 'popularity') {
        allServices.sort((a, b) => {
          const popA = a.popularity || a.rating || 0;
          const popB = b.popularity || b.rating || 0;
          return order === 'desc' ? popB - popA : popA - popB;
        });
      }

      const result = allServices.slice(0, limit);

      this.logger.log(
        `✅ Returning ${result.length} services (total found: ${allServices.length})`,
      );
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Error fetching services: ${errorMessage}`);
      throw error;
    }
  }

  async getRecentServices(limit: number): Promise<ServiceItem[]> {
    return this.getAllServices({
      sortBy: 'date',
      order: 'desc',
      limit,
    });
  }

  async getPopularServices(limit: number): Promise<ServiceItem[]> {
    return this.getAllServices({
      sortBy: 'popularity',
      order: 'desc',
      limit,
    });
  }

  private async getCarwashServices(): Promise<ServiceItem[]> {
    const carwashes = await this.carwashModel.find({}).exec();
    return carwashes.map((carwash) => ({
      id: String(carwash.id),
      title: carwash.name,
      description: carwash.description,
      type: 'carwash' as const,
      location: carwash.location,
      price: `${carwash.price}₾`,
      images:
        carwash.images && carwash.images.length > 0
          ? carwash.images
          : [
              'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=400&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1583121274602-3e2820c69888?q=80&w=400&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=400&auto=format&fit=crop',
            ],
      phone: carwash.phone,
      rating: carwash.rating,
      reviews: carwash.reviews,
      createdAt: new Date(carwash.createdAt || Date.now()),
      updatedAt: new Date(carwash.updatedAt || Date.now()),
      popularity: carwash.rating,
      isOpen: carwash.isOpen,
      category: carwash.category,
    }));
  }

  private async getStoreServices(): Promise<ServiceItem[]> {
    // მხოლოდ active მაღაზიები
    const stores = await this.storeModel.find({ status: 'active' }).exec();
    return stores.map((store) => ({
      id: store._id.toString(),
      title: store.title,
      description: store.description,
      type: 'store' as const,
      location: store.location,
      images:
        store.images && store.images.length > 0
          ? store.images
          : [
              'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=400&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?q=80&w=400&auto=format&fit=crop',
            ],
      phone: store.phone,
      createdAt: new Date(
        (store as { createdAt?: Date }).createdAt?.getTime() || Date.now(),
      ),
      updatedAt: new Date(
        (store as { updatedAt?: Date }).updatedAt?.getTime() || Date.now(),
      ),
      category: store.type,
      popularity: Math.random() * 5, // Temporary until we have real popularity data
    }));
  }

  private async getDismantlerServices(): Promise<ServiceItem[]> {
    const dismantlers = await this.dismantlerModel.find({}).exec();
    return dismantlers.map((dismantler) => ({
      id: dismantler._id.toString(),
      title: `${dismantler.brand} ${dismantler.model} (${dismantler.yearFrom}-${dismantler.yearTo})`,
      description: dismantler.description,
      type: 'dismantler' as const,
      location: dismantler.location,
      images:
        dismantler.photos && dismantler.photos.length > 0
          ? dismantler.photos
          : [
              'https://images.unsplash.com/photo-1549317336-206569e8475c?q=80&w=400&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?q=80&w=400&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1502877338535-766e1452684a?q=80&w=400&auto=format&fit=crop',
            ],
      phone: dismantler.phone,
      createdAt: new Date(
        (dismantler as { createdAt?: Date }).createdAt?.getTime() || Date.now(),
      ),
      updatedAt: new Date(
        (dismantler as { updatedAt?: Date }).updatedAt?.getTime() || Date.now(),
      ),
      category: `${dismantler.brand} ${dismantler.model}`,
      popularity: dismantler.views || 0,
    }));
  }

  private async getPartServices(): Promise<ServiceItem[]> {
    const parts = await this.partModel.find({}).exec();
    return parts.map((part) => ({
      id: part._id.toString(),
      title: part.title,
      description: part.description,
      type: 'part' as const,
      location: part.location,
      price: part.price,
      images:
        part.images && part.images.length > 0
          ? part.images
          : [
              'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=400&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=400&auto=format&fit=crop',
              'https://images.unsplash.com/photo-1583121274602-3e2820c69888?q=80&w=400&auto=format&fit=crop',
            ],
      phone: part.phone,
      createdAt: new Date(part.createdAt || Date.now()),
      updatedAt: new Date(part.updatedAt || Date.now()),
      category: part.category,
      popularity: Math.random() * 5, // Temporary
    }));
  }

  private async getCategoryServices(): Promise<ServiceItem[]> {
    const categories = await this.categoryModel.find({ isActive: true }).exec();
    return categories.map((category) => ({
      id: category._id.toString(),
      title: category.name,
      description: category.description,
      type: 'category' as const,
      images: category.image
        ? [category.image]
        : [
            'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?q=80&w=400&auto=format&fit=crop',
          ],
      createdAt: new Date(category.createdAt || Date.now()),
      updatedAt: new Date(category.updatedAt || Date.now()),
      category: category.nameEn,
      popularity: category.popularity,
    }));
  }

  /**
   * აიღებს ყველა სერვისს რომლებსაც აქვთ latitude და longitude
   * ეს მეთოდი გამოიყენება რუკაზე სერვისების ჩვენებისთვის
   */
  async getServicesForMap(): Promise<MapServiceItem[]> {
    this.logger.log('🗺️ Fetching services for map with coordinates');

    const mapServices: MapServiceItem[] = [];

    try {
      // Parallel queries for better performance
      const promises: Promise<MapServiceItem[]>[] = [];

      // Carwash services with coordinates
      promises.push(this.getCarwashServicesForMap());

      // Store services with coordinates
      promises.push(this.getStoreServicesForMap());

      // Service (auto-services) with coordinates
      promises.push(this.getAutoServicesForMap());

      const results = await Promise.all(promises);

      // Flatten all results
      results.forEach((serviceArray) => {
        mapServices.push(...serviceArray);
      });

      this.logger.log(
        `✅ Returning ${mapServices.length} services with coordinates for map`,
      );
      return mapServices;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Error fetching services for map: ${errorMessage}`);
      throw error;
    }
  }

  private async getCarwashServicesForMap(): Promise<MapServiceItem[]> {
    const carwashes = await this.carwashModel
      .find({
        latitude: { $exists: true, $ne: null },
        longitude: { $exists: true, $ne: null },
      })
      .exec();

    return carwashes.map((carwash) => ({
      id: String(carwash.id),
      title: carwash.name,
      description: carwash.description,
      type: 'carwash' as const,
      location: carwash.location,
      address: carwash.address,
      price: `${carwash.price}₾`,
      images:
        carwash.images && carwash.images.length > 0
          ? carwash.images
          : [
              'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=400&auto=format&fit=crop',
            ],
      phone: carwash.phone,
      rating: carwash.rating,
      reviews: carwash.reviews,
      latitude: carwash.latitude!,
      longitude: carwash.longitude!,
      isOpen: carwash.isOpen,
      category: carwash.category,
      workingHours: carwash.workingHours,
      services: carwash.detailedServices?.map((s) => s.name) || [],
    }));
  }

  private async getStoreServicesForMap(): Promise<MapServiceItem[]> {
    const stores = await this.storeModel
      .find({
        latitude: { $exists: true, $ne: null },
        longitude: { $exists: true, $ne: null },
        status: 'active', // მხოლოდ active მაღაზიები რუკაზე
      })
      .exec();

    return stores.map((store) => ({
      id: store._id.toString(),
      title: store.title,
      description: store.description,
      type: 'store' as const,
      location: store.location,
      address: store.address,
      images:
        store.images && store.images.length > 0
          ? store.images
          : [
              'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=400&auto=format&fit=crop',
            ],
      phone: store.phone,
      latitude: store.latitude!,
      longitude: store.longitude!,
      category: store.type,
      workingHours: store.workingHours,
      services: store.services || [],
    }));
  }

  private async getAutoServicesForMap(): Promise<MapServiceItem[]> {
    const services = await this.serviceModel
      .find({
        latitude: { $exists: true, $ne: null },
        longitude: { $exists: true, $ne: null },
      })
      .exec();

    return services.map((service) => ({
      id: service._id.toString(),
      title: service.name,
      description: service.description,
      type: 'service' as const,
      location: service.location,
      address: service.address,
      price: service.price,
      images:
        service.images && service.images.length > 0
          ? service.images
          : service.avatar
            ? [service.avatar]
            : [
                'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=400&auto=format&fit=crop',
              ],
      phone: service.phone,
      rating: service.rating,
      reviews: service.reviews,
      latitude: service.latitude!,
      longitude: service.longitude!,
      isOpen: service.isOpen,
      category: service.category,
      workingHours: service.workingHours,
      services: service.services || [],
      waitTime: service.waitTime,
      features: service.features,
    }));
  }
}
