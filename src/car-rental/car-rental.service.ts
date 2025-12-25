import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CarRental, CarRentalDocument } from '../schemas/car-rental.schema';

export interface GetRentalCarsOptions {
  location?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  transmission?: string;
  fuelType?: string;
  seats?: number;
  sortBy?: 'price' | 'rating' | 'date';
  order?: 'asc' | 'desc';
  limit?: number;
  available?: boolean;
}

@Injectable()
export class CarRentalService {
  private readonly logger = new Logger(CarRentalService.name);

  constructor(
    @InjectModel(CarRental.name)
    private carRentalModel: Model<CarRentalDocument>,
  ) {}

  /**
   * მიიღე ხელმისაწვდომი ფილტრები (დინამიურად database-იდან)
   */
  async getAvailableFilters() {
    this.logger.log('🔍 Fetching available filters...');

    try {
      // მიიღე ყველა აქტიური მანქანა
      const cars = await this.carRentalModel
        .find({ isActive: true })
        .select('category location brand transmission fuelType seats pricePerDay')
        .exec();

      // გამოთვალე უნიკალური მნიშვნელობები
      const categories = [...new Set(cars.map((c) => c.category).filter(Boolean))];
      const locations = [...new Set(cars.map((c) => c.location).filter(Boolean))];
      const brands = [...new Set(cars.map((c) => c.brand).filter(Boolean))].sort();
      const transmissions = [...new Set(cars.map((c) => c.transmission).filter(Boolean))];
      const fuelTypes = [...new Set(cars.map((c) => c.fuelType).filter(Boolean))];
      const seatOptions = [...new Set(cars.map((c) => c.seats).filter(Boolean))].sort(
        (a, b) => a - b,
      );

      // ფასის დიაპაზონი
      const prices = cars.map((c) => c.pricePerDay).filter(Boolean);
      const priceRange = {
        min: prices.length > 0 ? Math.min(...prices) : 0,
        max: prices.length > 0 ? Math.max(...prices) : 1000,
      };

      const filters = {
        categories,
        locations,
        brands,
        transmissions,
        fuelTypes,
        seatOptions,
        priceRange,
        totalCars: cars.length,
      };

      this.logger.log(`✅ Found filters for ${cars.length} cars`);
      return filters;
    } catch (error) {
      this.logger.error('❌ Error fetching filters:', error);
      throw error;
    }
  }

  /**
   * მიიღე ყველა ხელმისაწვდომი გასაქირავებელი მანქანა
   */
  async getAllRentalCars(
    options: GetRentalCarsOptions = {},
  ): Promise<CarRental[]> {
    const {
      location,
      category,
      minPrice,
      maxPrice,
      transmission,
      fuelType,
      seats,
      sortBy = 'date',
      order = 'desc',
      limit = 50,
      available = true,
    } = options;

    this.logger.log('🚗 Fetching rental cars with options:', options);

    // Build query
    const query: any = { isActive: true };

    if (available !== undefined) {
      query.available = available;
    }

    if (location) {
      query.location = new RegExp(location, 'i');
    }

    if (category) {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.pricePerDay = {};
      if (minPrice) query.pricePerDay.$gte = minPrice;
      if (maxPrice) query.pricePerDay.$lte = maxPrice;
    }

    if (transmission) {
      query.transmission = transmission;
    }

    if (fuelType) {
      query.fuelType = fuelType;
    }

    if (seats) {
      query.seats = seats;
    }

    // Build sort
    const sort: any = {};
    if (sortBy === 'price') {
      sort.pricePerDay = order === 'asc' ? 1 : -1;
    } else if (sortBy === 'rating') {
      sort.rating = order === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = order === 'asc' ? 1 : -1;
    }

    const cars = await this.carRentalModel
      .find(query)
      .sort(sort)
      .limit(limit)
      .exec();

    this.logger.log(`✅ Found ${cars.length} rental cars`);
    return cars;
  }

  /**
   * მიიღე ერთი მანქანა ID-ს მიხედვით
   */
  async getRentalCarById(id: string): Promise<CarRental> {
    this.logger.log(`🔍 Fetching rental car with id: ${id}`);

    const car = await this.carRentalModel.findById(id).exec();

    if (!car) {
      throw new NotFoundException(`Rental car with id ${id} not found`);
    }

    // Increment views
    await this.carRentalModel.updateOne({ _id: id }, { $inc: { views: 1 } });

    return car;
  }

  /**
   * შექმენი ახალი გასაქირავებელი მანქანა
   */
  async createRentalCar(data: Partial<CarRental>): Promise<CarRental> {
    this.logger.log('➕ Creating new rental car:', data.brand, data.model);

    const newCar = new this.carRentalModel({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedCar = await newCar.save();
    this.logger.log(`✅ Created rental car with id: ${savedCar._id}`);

    return savedCar;
  }

  /**
   * განაახლე მანქანის მონაცემები
   */
  async updateRentalCar(
    id: string,
    data: Partial<CarRental>,
  ): Promise<CarRental> {
    this.logger.log(`🔄 Updating rental car: ${id}`);

    const updatedCar = await this.carRentalModel
      .findByIdAndUpdate(
        id,
        { ...data, updatedAt: new Date() },
        { new: true },
      )
      .exec();

    if (!updatedCar) {
      throw new NotFoundException(`Rental car with id ${id} not found`);
    }

    this.logger.log(`✅ Updated rental car: ${id}`);
    return updatedCar;
  }

  /**
   * წაშალე მანქანა (soft delete - isActive = false)
   */
  async deleteRentalCar(id: string): Promise<{ message: string }> {
    this.logger.log(`🗑️ Deleting rental car: ${id}`);

    const result = await this.carRentalModel
      .findByIdAndUpdate(id, { isActive: false }, { new: true })
      .exec();

    if (!result) {
      throw new NotFoundException(`Rental car with id ${id} not found`);
    }

    this.logger.log(`✅ Deleted rental car: ${id}`);
    return { message: 'Rental car deleted successfully' };
  }

  /**
   * მიიღე პოპულარული გასაქირავებელი მანქანები
   */
  async getPopularRentalCars(limit: number = 10): Promise<CarRental[]> {
    this.logger.log(`⭐ Fetching top ${limit} popular rental cars`);

    const cars = await this.carRentalModel
      .find({ isActive: true, available: true })
      .sort({ rating: -1, totalBookings: -1, views: -1 })
      .limit(limit)
      .exec();

    this.logger.log(`✅ Found ${cars.length} popular rental cars`);
    return cars;
  }

  /**
   * მიიღე ბოლოს დამატებული მანქანები
   */
  async getRecentRentalCars(limit: number = 10): Promise<CarRental[]> {
    this.logger.log(`🆕 Fetching ${limit} recent rental cars`);

    const cars = await this.carRentalModel
      .find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    this.logger.log(`✅ Found ${cars.length} recent rental cars`);
    return cars;
  }

  /**
   * დააჯავშნე მანქანა (დაამატე გაუმისაწვდომო თარიღები)
   */
  async bookRentalCar(
    id: string,
    startDate: string,
    endDate: string,
  ): Promise<CarRental> {
    this.logger.log(`📅 Booking rental car ${id} from ${startDate} to ${endDate}`);

    const car = await this.carRentalModel.findById(id).exec();

    if (!car) {
      throw new NotFoundException(`Rental car with id ${id} not found`);
    }

    if (!car.available) {
      throw new Error('Car is not available for booking');
    }

    // Add dates to unavailableDates
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    const updatedCar = await this.carRentalModel
      .findByIdAndUpdate(
        id,
        {
          $addToSet: { unavailableDates: { $each: dates } },
          $inc: { totalBookings: 1 },
          updatedAt: new Date(),
        },
        { new: true },
      )
      .exec();

    this.logger.log(`✅ Booked rental car ${id}`);
    return updatedCar!;
  }

  /**
   * გააუქმე დაჯავშნა (წაშალე თარიღები)
   */
  async cancelBooking(
    id: string,
    startDate: string,
    endDate: string,
  ): Promise<CarRental> {
    this.logger.log(`❌ Cancelling booking for car ${id}`);

    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    const updatedCar = await this.carRentalModel
      .findByIdAndUpdate(
        id,
        {
          $pullAll: { unavailableDates: dates },
          updatedAt: new Date(),
        },
        { new: true },
      )
      .exec();

    if (!updatedCar) {
      throw new NotFoundException(`Rental car with id ${id} not found`);
    }

    this.logger.log(`✅ Cancelled booking for car ${id}`);
    return updatedCar;
  }

  /**
   * შეამოწმე ხელმისაწვდომობა კონკრეტულ თარიღებზე
   */
  async checkAvailability(
    id: string,
    startDate: string,
    endDate: string,
  ): Promise<{ available: boolean; unavailableDates: string[] }> {
    this.logger.log(`🔍 Checking availability for car ${id}`);

    const car = await this.carRentalModel.findById(id).exec();

    if (!car) {
      throw new NotFoundException(`Rental car with id ${id} not found`);
    }

    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    const unavailable = dates.filter((date) =>
      car.unavailableDates.includes(date),
    );

    return {
      available: unavailable.length === 0 && car.available,
      unavailableDates: unavailable,
    };
  }
}

