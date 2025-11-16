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
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CarwashService {
  private readonly logger = new Logger(CarwashService.name);

  private popularLocationsCache: {
    data: any[];
    timestamp: number;
  } | null = null;

  private readonly CACHE_DURATION = 5 * 60 * 1000;
  constructor(
    @InjectModel(CarwashLocation.name)
    private readonly carwashModel: Model<CarwashLocationDocument>,
    @InjectModel(CarwashBooking.name)
    private readonly bookingModel: Model<CarwashBookingDocument>,
    private readonly notificationsService: NotificationsService,
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
      // Push notify carwash owner about new booking
      try {
        const location = await this.carwashModel
          .findOne({ id: dto.locationId })
          .lean();
        const ownerId = (location as any)?.ownerId;
        if (ownerId) {
          await this.notificationsService.sendPushToTargets(
            [{ userId: String(ownerId) }],
            {
              title: 'MARTE - მართე',
              body: `${dto.locationName || location?.name || 'სამრეცხაო'} • ${
                dto.serviceName || 'სერვისი'
              } ${dto.bookingTime ? '• ' + dto.bookingTime : ''}`,
              data: {
                type: 'carwash_booking',
                screen: 'Bookings',
                carwashId: dto.locationId,
                bookingId: (saved as any)._id?.toString() || saved.id,
              },
              sound: 'default',
              badge: 1,
            },
            'system',
          );
        }
      } catch (e) {
        this.logger.warn('createBooking push send failed', e);
      }
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

    try {
      if (updates['status'] === 'confirmed') {
        const bookingJson: any = updated.toJSON();
        const customerUserId: string | undefined = bookingJson?.userId;
        const locationId: string | undefined = bookingJson?.locationId;
        const locationName: string | undefined = bookingJson?.locationName;
        const bookingTime: string | undefined = bookingJson?.bookingTime;

        if (customerUserId) {
          await this.notificationsService.sendPushToTargets(
            [{ userId: String(customerUserId) }],
            {
              title: '✅ ჯავშანი დადასტურებულია',
              body: `${locationName || 'სამრეცხაო'} • დრო: ${bookingTime || ''} — გმადლობთ, რომ ირჩევთ ჩვენს სერვისს!`,
              data: {
                type: 'carwash_booking_confirmed',
                screen: 'Bookings',
                carwashId: locationId || '',
                bookingId: bookingJson?.id || id,
              },
              sound: 'default',
              badge: 1,
            },
            'system',
          );
          this.logger.log(
            `✅ Sent confirmation push to user ${customerUserId} for booking ${id}`,
          );
        } else {
          this.logger.warn(
            `⚠️ Booking ${id} has no userId; skipping confirmation push`,
          );
        }
      }
    } catch (e) {
      this.logger.warn(
        `⚠️ updateBooking confirmation push failed for ${id}`,
        e,
      );
    }
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

  // Reminders (run via controller endpoint/cron)
  private parseSlotTimestamp(booking: any): number | null {
    const dayTs = Number(booking.bookingDate);
    const timeStr = String(booking.bookingTime || '');
    if (!Number.isFinite(dayTs) || !timeStr.includes(':')) return null;
    const [hh, mm] = timeStr.split(':').map((v: string) => parseInt(v, 10));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    return dayTs + (hh * 60 + mm) * 60 * 1000;
  }

  async sendUpcomingReminders(): Promise<{ sent: number }> {
    const now = Date.now();
    const windowStart = now + 29 * 60 * 1000;
    const windowEnd = now + 31 * 60 * 1000;

    const candidates = await this.bookingModel
      .find({ status: 'confirmed' })
      .limit(500)
      .lean();

    let sent = 0;
    for (const b of candidates) {
      if (b.reminderSentAt) continue;
      const slotTs = this.parseSlotTimestamp(b);
      if (!slotTs) continue;
      if (slotTs >= windowStart && slotTs <= windowEnd) {
        try {
          await this.notificationsService.sendPushToTargets(
            [{ userId: String(b.userId) }],
            {
              title: '⏰ შეხსენება ჯავშანზე',
              body: `${b.locationName || 'სამრეცხაო'} • დაწყება ${b.bookingTime || ''}`,
              data: {
                type: 'carwash_booking_reminder',
                screen: 'Bookings',
                carwashId: b.locationId,
                bookingId: String((b as any)._id || b.id || ''),
              },
              sound: 'default',
              badge: 1,
            },
            'system',
          );
          await this.bookingModel.updateOne(
            { _id: (b as any)._id },
            { $set: { reminderSentAt: now } },
          );
          sent += 1;
        } catch {}
      }
    }
    return { sent };
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
    // კეშირებული მონაცემების შემოწმება
    if (
      this.popularLocationsCache &&
      Date.now() - this.popularLocationsCache.timestamp < this.CACHE_DURATION
    ) {
      this.logger.log('📦 Returning cached popular locations');
      return this.popularLocationsCache.data.slice(0, limit);
    }

    this.logger.log('🔄 Fetching fresh popular locations from database');

    // MongoDB query - გაფილტრული და ოპტიმიზირებული
    const locations = await this.carwashModel
      .find({
        isOpen: true,
        rating: { $gte: 4.0 },
      })
      .sort({ rating: -1, reviews: -1 })
      .limit(limit * 2) // მეტი ამოვიღოთ რომ ალგორითმისთვის საკმარისი იყოს
      .exec();

    const scoredLocations = locations.map((location) => {
      const ratingScore = (location.rating || 0) * 40; // 0-40 ქულა
      const reviewsScore = Math.min((location.reviews || 0) * 0.5, 25); // 0-25 ქულა
      const openScore = location.isOpen ? 15 : 0; // 0-15 ქულა
      const priceScore = Math.max(
        0,
        10 - Math.abs((location.price || 30) - 30) * 0.2,
      ); // 0-10 ქულა (საშუალო ფასი 30₾)
      const servicesScore = Math.min(
        (location.detailedServices?.length || 0) * 2,
        10,
      ); // 0-10 ქულა

      const totalScore =
        ratingScore + reviewsScore + openScore + priceScore + servicesScore;

      return {
        ...location.toObject(),
        popularityScore: totalScore,
      };
    });

    // დახარისხება პოპულარობის მიხედვით
    scoredLocations.sort((a, b) => b.popularityScore - a.popularityScore);

    const result = scoredLocations.slice(0, limit);

    // კეშირება
    this.popularLocationsCache = {
      data: scoredLocations,
      timestamp: Date.now(),
    };

    this.logger.log(
      `✅ Returning ${result.length} popular locations with popularity scores`,
    );
    return result;
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
