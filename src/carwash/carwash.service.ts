import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId, Types } from 'mongoose';
import {
  CarwashLocation,
  CarwashLocationDocument,
} from '../schemas/carwash-location.schema';
import {
  CarwashBooking,
  CarwashBookingDocument,
} from '../schemas/carwash-booking.schema';
import { CreateCarwashBookingDto } from './dto/create-carwash-booking.dto';
import { UpdateCarwashBookingDto } from './dto/update-carwash-booking.dto';
import { CreateCarwashLocationDto } from './dto/create-carwash-location.dto';
import { UpdateCarwashLocationDto } from './dto/update-carwash-location.dto';

@Injectable()
export class CarwashService {
  private readonly logger = new Logger(CarwashService.name);
  constructor(
    @InjectModel(CarwashLocation.name)
    private readonly carwashModel: Model<CarwashLocationDocument>,
    @InjectModel(CarwashBooking.name)
    private readonly bookingModel: Model<CarwashBookingDocument>,
  ) {}

  // Bookings
  private async findBookingOrThrow(id: string) {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('booking_not_found');
    }
    const doc = await this.bookingModel.findById(id).exec();
    if (!doc) throw new NotFoundException('booking_not_found');
    return doc;
  }

  async createBooking(dto: CreateCarwashBookingDto) {
    this.logger.log(`createBooking received: ${JSON.stringify(dto)}`);
    const booking = new this.bookingModel({
      ...dto,
      status: 'pending',
    });
    try {
      const saved = await booking.save();
      this.logger.log(`createBooking saved id=${saved.id || saved._id}`);
      return saved;
    } catch (err: any) {
      this.logger.error(
        `createBooking validation error: ${err?.message}`,
        err?.stack,
      );
      throw err;
    }
  }

  async findAllBookings(userId?: string) {
    const filter: Record<string, unknown> = {};
    if (userId) filter.userId = userId;
    return this.bookingModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findBookingById(id: string) {
    return this.findBookingOrThrow(id);
  }

  async updateBooking(id: string, dto: UpdateCarwashBookingDto) {
    // Avoid validators entirely: update then fetch
    this.logger.log(`updateBooking start id=${id} dto=${JSON.stringify(dto)}`);
    if (!isValidObjectId(id)) {
      throw new NotFoundException('booking_not_found');
    }
    // Only set fields that are not null/undefined to avoid accidental nulling
    const updates: Record<string, unknown> = {};
    Object.entries(dto || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        updates[key] = value;
      }
    });
    if (Object.keys(updates).length > 0) {
      await this.bookingModel.collection.updateOne(
        { _id: new Types.ObjectId(id) },
        { $set: updates },
      );
    }
    const updated = await this.bookingModel.findById(id).exec();
    this.logger.log(`updateBooking done id=${id} found=${!!updated}`);
    if (!updated) throw new NotFoundException('booking_not_found');
    return updated;
  }

  async cancelBooking(id: string) {
    return this.updateBooking(id, { status: 'cancelled' });
  }

  async confirmBooking(id: string) {
    return this.updateBooking(id, { status: 'confirmed' });
  }

  async startBooking(id: string) {
    return this.updateBooking(id, { status: 'in_progress' });
  }

  async completeBooking(id: string) {
    return this.updateBooking(id, { status: 'completed' });
  }

  async deleteBooking(id: string) {
    const booking = await this.findBookingOrThrow(id);
    await booking.deleteOne();
    return { success: true };
  }

  async getBookingsByLocation(locationId: string) {
    return this.bookingModel
      .find({ locationId })
      .sort({ bookingDate: -1 })
      .exec();
  }

  async getBookingsByDate(date: string) {
    const start = new Date(date + 'T00:00:00Z').getTime();
    const end = new Date(date + 'T23:59:59Z').getTime();
    return this.bookingModel
      .find({ bookingDate: { $gte: start, $lte: end } })
      .sort({ bookingTime: 1 })
      .exec();
  }

  // Locations
  async createLocation(dto: CreateCarwashLocationDto) {
    const now = Date.now();
    const id = `cw_${now}`;
    const loc = new this.carwashModel({
      ...dto,
      id,
      createdAt: now,
      updatedAt: now,
      detailedServices: dto.detailedServices || [],
      timeSlotsConfig:
        dto.timeSlotsConfig ||
        ({ workingDays: [], interval: 60, breakTimes: [] } as any),
      availableSlots: [],
      realTimeStatus:
        dto.realTimeStatus ||
        ({
          isOpen: !!dto.isOpen,
          currentWaitTime: 0,
          currentQueue: 0,
          estimatedWaitTime: 0,
          lastStatusUpdate: now,
        } as any),
    });
    return loc.save();
  }

  async findAllLocations() {
    return this.carwashModel.find({}).sort({ rating: -1 }).exec();
  }

  async getPopularLocations(limit = 10) {
    return this.carwashModel.find({}).sort({ rating: -1 }).limit(limit).exec();
  }

  

  async findLocationById(id: string) {
    const doc = await this.carwashModel.findOne({ id }).exec();
    if (!doc) throw new NotFoundException('location_not_found');
    return doc;
  }

  async findLocationsByOwner(ownerId: string) {
    return this.carwashModel.find({ ownerId }).exec();
  }

  async updateLocation(id: string, dto: UpdateCarwashLocationDto) {
    const doc = await this.carwashModel
      .findOneAndUpdate(
        { id },
        { ...dto, updatedAt: Date.now() },
        { new: true },
      )
      .exec();
    if (!doc) throw new NotFoundException('location_not_found');
    return doc;
  }

  async deleteLocation(id: string) {
    const res = await this.carwashModel.findOneAndDelete({ id }).exec();
    if (!res) throw new NotFoundException('location_not_found');
    return { success: true };
  }

  async getServices(id: string) {
    const loc = await this.findLocationById(id);
    return loc.detailedServices || [];
  }

  async updateServices(id: string, services: any[]) {
    const loc = await this.carwashModel
      .findOneAndUpdate(
        { id },
        { detailedServices: services, updatedAt: Date.now() },
        { new: true },
      )
      .exec();
    if (!loc) throw new NotFoundException('location_not_found');
    return loc.detailedServices || [];
  }

  async updateTimeSlotsConfig(id: string, config: any) {
    const loc = await this.carwashModel
      .findOneAndUpdate(
        { id },
        { timeSlotsConfig: config, updatedAt: Date.now() },
        { new: true },
      )
      .exec();
    if (!loc) throw new NotFoundException('location_not_found');
    return loc.timeSlotsConfig;
  }

  async getAvailableSlots(id: string, date?: string) {
    const loc = await this.findLocationById(id);
    if (!date) return loc.availableSlots || [];
    return (loc.availableSlots || []).find((d: any) => d.date === date) || null;
  }

  async updateAvailableSlots(id: string, daySlots: any[]) {
    const loc = await this.carwashModel
      .findOneAndUpdate(
        { id },
        { availableSlots: daySlots, updatedAt: Date.now() },
        { new: true },
      )
      .exec();
    if (!loc) throw new NotFoundException('location_not_found');
    return loc.availableSlots || [];
  }

  async bookTimeSlot(id: string, date: string, time: string, userId: string) {
    const loc = await this.findLocationById(id);
    const day = (loc.availableSlots || []).find((d: any) => d.date === date);
    if (!day) throw new BadRequestException('date_not_available');
    const slot = (day.slots || []).find((s: any) => s.time === time);
    if (!slot || !slot.available)
      throw new BadRequestException('slot_not_available');
    slot.available = false;
    (slot as any).bookedBy = userId;
    await this.carwashModel
      .updateOne(
        { id },
        { availableSlots: loc.availableSlots, updatedAt: Date.now() },
      )
      .exec();
    return { success: true };
  }

  async releaseTimeSlot(id: string, date: string, time: string) {
    const loc = await this.findLocationById(id);
    const day = (loc.availableSlots || []).find((d: any) => d.date === date);
    if (!day) throw new BadRequestException('date_not_found');
    const slot = (day.slots || []).find((s: any) => s.time === time);
    if (!slot) throw new BadRequestException('slot_not_found');
    slot.available = true;
    (slot as any).bookedBy = undefined;
    await this.carwashModel
      .updateOne(
        { id },
        { availableSlots: loc.availableSlots, updatedAt: Date.now() },
      )
      .exec();
    return { success: true };
  }

  async getRealTimeStatus(id: string) {
    const loc = await this.findLocationById(id);
    return (loc as any).realTimeStatus || null;
  }

  async updateRealTimeStatus(id: string, status: any) {
    const loc = await this.carwashModel
      .findOneAndUpdate(
        { id },
        {
          realTimeStatus: { ...(status || {}), lastStatusUpdate: Date.now() },
          updatedAt: Date.now(),
        },
        { new: true },
      )
      .exec();
    if (!loc) throw new NotFoundException('location_not_found');
    return (loc as any).realTimeStatus;
  }

  async toggleOpenStatus(id: string) {
    const loc = await this.findLocationById(id);
    const isOpen = !loc.isOpen;
    await this.carwashModel
      .updateOne({ id }, { isOpen, updatedAt: Date.now() })
      .exec();
    return { isOpen };
  }

  async updateWaitTime(id: string, waitTime: number) {
    if (typeof waitTime !== 'number')
      throw new BadRequestException('invalid_wait_time');
    const loc = await this.findLocationById(id);
    const status = {
      ...((loc as any).realTimeStatus || {}),
      currentWaitTime: waitTime,
      lastStatusUpdate: Date.now(),
    };
    await this.carwashModel
      .updateOne({ id }, { realTimeStatus: status, updatedAt: Date.now() })
      .exec();
    return status;
  }

  
}
