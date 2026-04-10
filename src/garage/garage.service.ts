/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { Car, CarDocument } from '../schemas/car.schema';
import { Reminder, ReminderDocument } from '../schemas/reminder.schema';
import { FuelEntry, FuelEntryDocument } from '../schemas/fuel-entry.schema';
import {
  ServiceHistory,
  ServiceHistoryDocument,
} from '../schemas/service-history.schema';
import { User, UserDocument } from '../schemas/user.schema';
import {
  FinesVehicle,
  FinesVehicleDocument,
} from '../schemas/fines-vehicle.schema';
import {
  FinesDailyReminder,
  FinesDailyReminderDocument,
} from '../schemas/fines-daily-reminder.schema';
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { CreateFuelEntryDto } from './dto/create-fuel-entry.dto';
import { CreateServiceHistoryDto } from './dto/create-service-history.dto';
import { UpdateServiceHistoryDto } from './dto/update-service-history.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class GarageService {
  private readonly logger = new Logger(GarageService.name);
  private readonly reminderTz = 'Asia/Tbilisi';
  private isSendingReminders = false; // Lock mechanism to prevent duplicate executions

  constructor(
    @InjectModel(Car.name) private carModel: Model<CarDocument>,
    @InjectModel(Reminder.name) private reminderModel: Model<ReminderDocument>,
    @InjectModel(FuelEntry.name)
    private fuelEntryModel: Model<FuelEntryDocument>,
    @InjectModel(ServiceHistory.name)
    private serviceHistoryModel: Model<ServiceHistoryDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(FinesVehicle.name)
    private finesVehicleModel: Model<FinesVehicleDocument>,
    @InjectModel(FinesDailyReminder.name)
    private finesDailyReminderModel: Model<FinesDailyReminderDocument>,
    private notificationsService: NotificationsService,
  ) {}

  private toPlain<T = any>(doc: any): T {
    return typeof doc?.toJSON === 'function' ? (doc.toJSON() as T) : (doc as T);
  }

  /** YYYY-MM-DD + წუთები თბილისის დროით (notificationSentDate / „9 საათის“ შემოწმება) */
  private getTbilisiYmdAndMinutes(d: Date): {
    ymd: string;
    minutesSinceMidnight: number;
  } {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.reminderTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(d);
    const g = (t: Intl.DateTimeFormatPart['type']) =>
      parts.find((p) => p.type === t)?.value ?? '0';
    const hour = parseInt(g('hour'), 10);
    const minute = parseInt(g('minute'), 10);
    return {
      ymd: `${g('year')}-${g('month')}-${g('day')}`,
      minutesSinceMidnight: hour * 60 + minute,
    };
  }

  /**
   * თბილისის კალენდარული დღის YYYY-MM-DD → იმ დღის 00:00 თბილისში UTC-ში (UTC+4, DST არა).
   */
  private tbilisiDayStartUtcMs(ymd: string): number {
    const [y, m, d] = ymd.split('-').map(Number);
    return Date.UTC(y, m - 1, d) - 4 * 60 * 60 * 1000;
  }

  /** დღის დასასრული თბილისში (ინკლუზივ) UTC ms-ში */
  private tbilisiDayEndUtcMs(ymd: string): number {
    return this.tbilisiDayStartUtcMs(ymd) + 24 * 60 * 60 * 1000 - 1;
  }

  /** რამდენი კალენდარული დღითაა მოვლენა წინ (თბილისი): 0=დღეს, 1=ხვალ, ... */
  private tbilisiCalendarDaysUntilEvent(
    nowMs: number,
    eventInstantMs: number,
  ): number {
    const n = this.getTbilisiYmdAndMinutes(new Date(nowMs)).ymd;
    const e = this.getTbilisiYmdAndMinutes(new Date(eventInstantMs)).ymd;
    const n0 = this.tbilisiDayStartUtcMs(n);
    const e0 = this.tbilisiDayStartUtcMs(e);
    return Math.round((e0 - n0) / (24 * 60 * 60 * 1000));
  }

  private normalizeReminderClock(raw?: string): string | null {
    if (!raw || typeof raw !== 'string') return null;
    const m = raw.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
    const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  /** დღეს (თბილისი) არჩეულ საათზე UTC instant */
  private getTbilisiTodayAtClockUtcMs(nowMs: number, hhmm: string): number {
    const clock = this.normalizeReminderClock(hhmm) || '09:00';
    const [h, mi] = clock.split(':').map(Number);
    const ymd = this.getTbilisiYmdAndMinutes(new Date(nowMs)).ymd;
    return this.tbilisiDayStartUtcMs(ymd) + (h * 60 + mi) * 60 * 1000;
  }

  /**
   * მიზნის UTC მომენტი ±5 წთ ან იმავე კალენდარულ დღეს catch-up (თბილისი) target დღისთვის.
   */
  private shouldFireAtTargetOrCatchup(
    nowMs: number,
    targetUtcMs: number,
    targetDayYmdTbilisi: string,
  ): boolean {
    const winBefore = targetUtcMs - 5 * 60 * 1000;
    const winAfter = targetUtcMs + 5 * 60 * 1000;
    if (nowMs >= winBefore && nowMs <= winAfter) return true;
    const end = this.tbilisiDayEndUtcMs(targetDayYmdTbilisi);
    return nowMs > winAfter && nowMs <= end;
  }

  private wasReminderSlotSentToday(
    reminder: any,
    todayStrTbilisi: string,
    slotKey: string,
  ): boolean {
    if ((reminder as any).notificationSentDate !== todayStrTbilisi)
      return false;
    const slots = String((reminder as any).notificationSentSlotsToday || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return slots.includes(slotKey);
  }

  private tbilisiWeekdayShort(ms: number): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: this.reminderTz,
      weekday: 'short',
    }).format(new Date(ms));
  }

  /** weekly/monthly/yearly — დღეს უნდა ჩავარდეს თუ არა (anchor = reminderDate) */
  private recurringMatchesCalendarDay(reminder: any, nowMs: number): boolean {
    const interval = reminder.recurringInterval;
    if (!interval || interval === 'none') return false;
    if (interval === 'daily') return true;
    const anchorMs = new Date(reminder.reminderDate).getTime();
    const aYmd = this.getTbilisiYmdAndMinutes(new Date(anchorMs)).ymd;
    const nYmd = this.getTbilisiYmdAndMinutes(new Date(nowMs)).ymd;
    const [, am, ad] = aYmd.split('-').map(Number);
    const [ny, nm, nd] = nYmd.split('-').map(Number);
    if (interval === 'yearly') return am === nm && ad === nd;
    if (interval === 'monthly') {
      const lastN = new Date(ny, nm, 0).getDate();
      const day = Math.min(ad, lastN);
      return nd === day;
    }
    if (interval === 'weekly') {
      return (
        this.tbilisiWeekdayShort(anchorMs) === this.tbilisiWeekdayShort(nowMs)
      );
    }
    return false;
  }

  private async attachCar(reminder: any) {
    if (!reminder) return reminder;
    const carId: string | undefined = (reminder as any).carId;
    if (!carId) return this.toPlain(reminder);
    const car = await this.carModel.findById(carId).exec();
    const plain = this.toPlain(reminder) as any;
    plain.car = car ? this.toPlain(car) : undefined;
    return plain;
  }

  private async attachCars(reminders: any[]) {
    if (!Array.isArray(reminders) || reminders.length === 0) return reminders;
    const carIds = Array.from(
      new Set(reminders.map((r: any) => r?.carId).filter(Boolean)),
    );
    const cars = carIds.length
      ? await this.carModel.find({ _id: { $in: carIds } }).exec()
      : [];
    const carMap = new Map(
      cars.map((c: any) => [String(c._id), this.toPlain(c)]),
    );
    return reminders.map((r: any) => {
      const plain = this.toPlain(r) as any;
      plain.car = r?.carId ? carMap.get(String(r.carId)) : undefined;
      return plain;
    });
  }

  // მანქანების CRUD
  async createCar(userId: string, createCarDto: CreateCarDto): Promise<Car> {
    const car = new this.carModel({
      ...createCarDto,
      userId,
      isActive: true,
    });
    return car.save();
  }

  async findAllCars(userId: string): Promise<Car[]> {
    return this.carModel
      .find({ userId, isActive: true })
      .sort({ createdAt: -1 })
      .exec();
  }

  // ადმინისთვის: ყველა იუზერის მანქანები იუზერის ინფორმაციით
  async findAllCarsWithUsers(): Promise<any[]> {
    const cars = await this.carModel
      .find({ isActive: true })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    // მოვიძებნოთ ყველა უნიკალური userId
    const userIds = Array.from(new Set(cars.map((car: any) => car.userId)));

    // მოვიძებნოთ იუზერები
    const users = await this.userModel
      .find({ id: { $in: userIds } })
      .lean()
      .exec();

    // შევქმნათ map userId -> user
    const userMap = new Map<string, any>(
      users.map((user: any) => {
        // lean() აბრუნებს plain object-ს, ამიტომ ხელით ვაკეთებთ transform
        const userId = user.id || (user._id ? String(user._id) : '');
        return [userId, user];
      }),
    );

    // მოვიძებნოთ ყველა carId
    const carIds = cars.map((car: any) => {
      return car.id || (car._id ? String(car._id) : '');
    });

    // მოვიძებნოთ შეხსენებები
    const reminders = await this.reminderModel
      .find({ carId: { $in: carIds }, isActive: true })
      .lean()
      .exec();

    // მოვიძებნოთ საწვავის ჩანაწერები
    const fuelEntries = await this.fuelEntryModel
      .find({ carId: { $in: carIds } })
      .sort({ date: -1 })
      .lean()
      .exec();

    // შევქმნათ map carId -> reminders
    const remindersMap = new Map<string, any[]>();
    reminders.forEach((reminder: any) => {
      const carId = String(reminder.carId || '');
      if (!remindersMap.has(carId)) {
        remindersMap.set(carId, []);
      }
      const reminderId =
        reminder.id || (reminder._id ? String(reminder._id) : '');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, __v, ...reminderData } = reminder;
      remindersMap.get(carId)?.push({
        ...reminderData,
        id: reminderId,
      });
    });

    // შევქმნათ map carId -> fuelEntries
    const fuelEntriesMap = new Map<string, any[]>();
    fuelEntries.forEach((entry: any) => {
      const carId = String(entry.carId || '');
      if (!fuelEntriesMap.has(carId)) {
        fuelEntriesMap.set(carId, []);
      }
      const entryId = entry.id || (entry._id ? String(entry._id) : '');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, __v, ...entryData } = entry;
      fuelEntriesMap.get(carId)?.push({
        ...entryData,
        id: entryId,
      });
    });

    // დავაბრუნოთ მანქანები იუზერის ინფორმაციით
    return cars.map((car: any) => {
      // lean() აბრუნებს plain object-ს, ამიტომ ხელით ვაკეთებთ transform _id -> id
      const carId = car.id || (car._id ? String(car._id) : '');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, __v, ...carData } = car;
      const plainCar = {
        ...carData,
        id: carId,
      };

      const userId = String(car.userId || '');
      const user: any = userMap.get(userId);

      // მოვიძებნოთ შეხსენებები ამ მანქანისთვის
      const carReminders = remindersMap.get(carId) || [];
      const remindersStats = {
        total: carReminders.length,
        completed: carReminders.filter((r: any) => r.isCompleted).length,
        pending: carReminders.filter((r: any) => r.isCompleted === false)
          .length,
        urgent: carReminders.filter((r: any) => r.isUrgent).length,
        upcoming: carReminders.filter((r: any) => {
          if (r.isCompleted) return false;
          const reminderDate = new Date(String(r.reminderDate || ''));
          return reminderDate >= new Date();
        }).length,
      };

      // მოვიძებნოთ საწვავის ჩანაწერები ამ მანქანისთვის
      const carFuelEntries = fuelEntriesMap.get(carId) || [];
      const fuelStats = {
        totalEntries: carFuelEntries.length,
        lastEntry: carFuelEntries.length > 0 ? carFuelEntries[0] : null,
        totalLiters: carFuelEntries.reduce(
          (sum: number, e: any) => sum + (e.liters || 0),
          0,
        ),
        totalSpent: carFuelEntries.reduce(
          (sum: number, e: any) => sum + (e.totalPrice || 0),
          0,
        ),
      };

      return {
        ...plainCar,
        user: user
          ? {
              id: user.id || (user._id ? String(user._id) : ''),
              phone: user.phone,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
            }
          : null,
        reminders: {
          list: carReminders,
          stats: remindersStats,
        },
        fuelEntries: {
          list: carFuelEntries,
          stats: fuelStats,
        },
      };
    });
  }

  async findOneCar(userId: string, id: string): Promise<Car> {
    const car = await this.carModel
      .findOne({ _id: id, userId, isActive: true })
      .exec();
    if (!car) {
      throw new NotFoundException(`Car with ID ${id} not found`);
    }
    return car;
  }

  async updateCar(
    userId: string,
    id: string,
    updateCarDto: UpdateCarDto,
  ): Promise<Car> {
    const car = await this.carModel
      .findOneAndUpdate({ _id: id, userId, isActive: true }, updateCarDto, {
        new: true,
      })
      .exec();
    if (!car) {
      throw new NotFoundException(`Car with ID ${id} not found`);
    }
    return car;
  }

  async removeCar(userId: string, id: string): Promise<void> {
    const result = await this.carModel
      .findOneAndUpdate(
        { _id: id, userId, isActive: true },
        { isActive: false },
      )
      .exec();
    if (!result) {
      throw new NotFoundException(`Car with ID ${id} not found`);
    }
  }

  // შეხსენებების CRUD
  async createReminder(
    userId: string,
    createReminderDto: CreateReminderDto,
  ): Promise<Reminder> {
    const priorityMap: Record<string, string> = {
      დაბალი: 'low',
      საშუალო: 'medium',
      მაღალი: 'high',
    };
    const normalizedPriority =
      priorityMap[createReminderDto.priority] ||
      createReminderDto.priority ||
      'medium';
    const reminder = new this.reminderModel({
      ...createReminderDto,
      priority: normalizedPriority,
      userId,
      reminderDate: new Date(createReminderDto.reminderDate),
      isCompleted: false,
      isUrgent: false,
      isActive: true,
    });
    const saved = await reminder.save();
    return (await this.attachCar(saved)) as any;
  }

  async findAllReminders(userId: string): Promise<Reminder[]> {
    const docs = await this.reminderModel
      .find({ userId, isActive: true })
      .sort({ reminderDate: 1 })
      .exec();
    return (await this.attachCars(docs)) as any;
  }

  async findRemindersByCar(userId: string, carId: string): Promise<Reminder[]> {
    const docs = await this.reminderModel
      .find({ userId, carId, isActive: true })
      .sort({ reminderDate: 1 })
      .exec();
    return (await this.attachCars(docs)) as any;
  }

  async findOneReminder(userId: string, id: string): Promise<Reminder> {
    const reminder = await this.reminderModel
      .findOne({ _id: id, userId, isActive: true })
      .exec();
    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }
    return (await this.attachCar(reminder)) as any;
  }

  async updateReminder(
    userId: string,
    id: string,
    updateReminderDto: UpdateReminderDto,
  ): Promise<Reminder> {
    const priorityMap: Record<string, string> = {
      დაბალი: 'low',
      საშუალო: 'medium',
      მაღალი: 'high',
    };
    const updateData: any = { ...updateReminderDto };
    if (updateData.priority) {
      updateData.priority =
        priorityMap[updateData.priority] || updateData.priority;
    }
    if (updateReminderDto.reminderDate) {
      updateData.reminderDate = new Date(updateReminderDto.reminderDate);
    }

    const reminder = await this.reminderModel
      .findOneAndUpdate({ _id: id, userId, isActive: true }, updateData, {
        new: true,
      })
      .exec();
    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }
    return (await this.attachCar(reminder)) as any;
  }

  async removeReminder(userId: string, id: string): Promise<void> {
    const result = await this.reminderModel
      .findOneAndUpdate(
        { _id: id, userId, isActive: true },
        { isActive: false },
      )
      .exec();
    if (!result) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }
  }

  async markReminderCompleted(userId: string, id: string): Promise<Reminder> {
    const reminder = await this.reminderModel
      .findOneAndUpdate(
        { _id: id, userId, isActive: true },
        { isCompleted: true },
        { new: true },
      )
      .exec();
    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }
    return (await this.attachCar(reminder)) as any;
  }

  // საწვავის ჩანაწერები
  async createFuelEntry(
    userId: string,
    createFuelEntryDto: CreateFuelEntryDto,
  ): Promise<FuelEntry> {
    const fuelEntry = new this.fuelEntryModel({
      ...createFuelEntryDto,
      userId,
    });
    return fuelEntry.save();
  }

  async listFuelEntries(userId: string): Promise<FuelEntry[]> {
    return this.fuelEntryModel.find({ userId }).sort({ date: -1 }).exec();
  }

  async listFuelEntriesByCar(
    userId: string,
    carId: string,
  ): Promise<FuelEntry[]> {
    return this.fuelEntryModel
      .find({ userId, carId })
      .sort({ date: -1 })
      .exec();
  }

  // სტატისტიკა
  async getGarageStats(userId: string) {
    const [
      totalCars,
      totalReminders,
      urgentReminders,
      upcomingReminders,
      completedReminders,
    ] = await Promise.all([
      this.carModel.countDocuments({ userId, isActive: true }),
      this.reminderModel.countDocuments({ userId, isActive: true }),
      this.reminderModel.countDocuments({
        userId,
        isActive: true,
        isUrgent: true,
      }),
      this.reminderModel.countDocuments({
        userId,
        isActive: true,
        isCompleted: false,
        reminderDate: { $gte: new Date() },
      }),
      this.reminderModel.countDocuments({
        userId,
        isActive: true,
        isCompleted: true,
      }),
    ]);

    return {
      totalCars,
      totalReminders,
      urgentReminders,
      upcomingReminders,
      completedReminders,
    };
  }

  /**
   * Cron job: გაიგზავნება push notifications reminder-ებისთვის
   * გაშვება: ყოველ 5 წუთში (Asia/Tbilisi timezone)
   * ლოგიკა (თბილისის დრო, მომხმარებლის reminderTime ან default 09:00):
   * - დღეს: მოვლენის UTC instant ±5 წთ + იმავე დღის catch-up
   * - ხვალ / 3 დღე (urgent): არჩეულ საათზე ±5 წთ + იმავე დღის catch-up
   * - Recurring daily: თითო დრო ცალკე სლოტით (დღეში 2 ჯერ); weekly/monthly/yearly: იმავე კალენდარულ დღეს + არჩეული საათი
   */
  @Cron('*/5 * * * *', {
    name: 'send-reminder-notifications',
    timeZone: 'Asia/Tbilisi',
  })
  async sendReminderNotifications(testMode = false): Promise<{ sent: number }> {
    // Prevent duplicate executions
    if (this.isSendingReminders) {
      this.logger.warn(
        '⚠️ Reminder notifications already in progress, skipping...',
      );
      return { sent: 0 };
    }

    this.isSendingReminders = true;
    this.logger.log(
      '🔔 შეხსენებების push notifications-ის გაგზავნა დაწყებულია...',
    );

    try {
      const now = Date.now();
      const tbNow = this.getTbilisiYmdAndMinutes(new Date(now));
      const todayStr = tbNow.ymd;
      const todayStart = this.tbilisiDayStartUtcMs(todayStr);
      const todayEnd = todayStart + 24 * 60 * 60 * 1000;
      const threeDaysStart = todayEnd + 2 * 24 * 60 * 60 * 1000;
      const threeDaysEnd = threeDaysStart + 24 * 60 * 60 * 1000;

      const candidates = await this.reminderModel
        .find({
          isActive: true,
          isCompleted: false,
          $or: [
            { notificationSentAt: { $exists: false } },
            { notificationSentDate: { $ne: todayStr } },
            {
              notificationSentDate: todayStr,
              notificationSentAt: {
                $lt: todayStart + 12 * 60 * 60 * 1000,
              },
            },
          ],
          reminderDate: {
            $gte: new Date(todayStart),
            $lte: new Date(threeDaysEnd),
          },
        })
        .limit(500)
        .lean()
        .exec();

      this.logger.log(
        `📊 ნაპოვნია ${candidates.length} reminder notification-ისთვის`,
      );

      let sent = 0;

      for (const reminder of candidates) {
        try {
          if (
            reminder.recurringInterval &&
            reminder.recurringInterval !== 'none'
          ) {
            const recurring = this.shouldSendRecurringReminder(
              reminder,
              now,
              todayStr,
            );
            if (recurring.shouldSend) {
              await this.sendReminderNotification(
                reminder,
                recurring.title,
                recurring.body,
                now,
                todayStr,
                recurring.slotKey,
              );
              sent += 1;
            }
            continue;
          }

          const reminderTimestamp = new Date(reminder.reminderDate).getTime();
          const daysUntil = this.tbilisiCalendarDaysUntilEvent(
            now,
            reminderTimestamp,
          );

          let shouldSend = false;
          let notificationTitle = '';
          let notificationBody = '';
          let slotKey = '';

          const clock =
            this.normalizeReminderClock(reminder.reminderTime) || '09:00';

          if (testMode) {
            if (daysUntil === 0) {
              shouldSend = true;
              slotKey = '__test_today__';
              notificationTitle = '⏰ შეხსენება დღეს';
              notificationBody = `${reminder.title} • დღეს უნდა შესრულდეს`;
            } else if (daysUntil === 1) {
              shouldSend = true;
              slotKey = '__test_adv1__';
              notificationTitle = '📅 შეხსენება ხვალ';
              notificationBody = `${reminder.title} • ხვალ უნდა შესრულდეს`;
            } else if (daysUntil === 3 && reminder.isUrgent) {
              shouldSend = true;
              slotKey = '__test_adv3__';
              notificationTitle = '🚨 გადაუდებელი შეხსენება';
              notificationBody = `${reminder.title} • 3 დღეში უნდა შესრულდეს`;
            }
          } else if (daysUntil === 0) {
            const eventDayYmd = this.getTbilisiYmdAndMinutes(
              new Date(reminderTimestamp),
            ).ymd;
            if (reminder.reminderTime) {
              slotKey = `event_${clock}`;
              if (this.wasReminderSlotSentToday(reminder, todayStr, slotKey)) {
                shouldSend = false;
              } else if (
                this.shouldFireAtTargetOrCatchup(
                  now,
                  reminderTimestamp,
                  eventDayYmd,
                )
              ) {
                shouldSend = true;
                notificationTitle = '⏰ შეხსენება დღეს';
                notificationBody = `${reminder.title} • დღეს ${reminder.reminderTime}-ზე`;
              }
            } else {
              slotKey = '__today_no_clock__';
              if (this.wasReminderSlotSentToday(reminder, todayStr, slotKey)) {
                shouldSend = false;
              } else {
                const targetMs = this.getTbilisiTodayAtClockUtcMs(now, '09:00');
                if (this.shouldFireAtTargetOrCatchup(now, targetMs, todayStr)) {
                  shouldSend = true;
                  notificationTitle = '⏰ შეხსენება დღეს';
                  notificationBody = `${reminder.title} • დღეს უნდა შესრულდეს`;
                }
              }
            }
          } else if (daysUntil === 1) {
            slotKey = '__adv1__';
            if (!this.wasReminderSlotSentToday(reminder, todayStr, slotKey)) {
              const targetMs = this.getTbilisiTodayAtClockUtcMs(now, clock);
              if (this.shouldFireAtTargetOrCatchup(now, targetMs, todayStr)) {
                shouldSend = true;
                notificationTitle = '📅 შეხსენება ხვალ';
                notificationBody = `${reminder.title} • ხვალ ${clock}-ზე`;
              }
            }
          } else if (daysUntil === 3 && reminder.isUrgent) {
            slotKey = '__adv3__';
            if (!this.wasReminderSlotSentToday(reminder, todayStr, slotKey)) {
              const targetMs = this.getTbilisiTodayAtClockUtcMs(now, clock);
              if (this.shouldFireAtTargetOrCatchup(now, targetMs, todayStr)) {
                shouldSend = true;
                notificationTitle = '🚨 გადაუდებელი შეხსენება';
                notificationBody = `${reminder.title} • 3 დღეში (${clock})`;
              }
            }
          }

          if (shouldSend && slotKey) {
            await this.sendReminderNotification(
              reminder,
              notificationTitle,
              notificationBody,
              now,
              todayStr,
              slotKey,
            );
            sent += 1;
          }
        } catch (error) {
          this.logger.error(
            `❌ შეცდომა reminder notification-ის გაგზავნისას: ${(error as Error).message}`,
          );
        }
      }

      this.logger.log(`✅ სულ გაიგზავნა ${sent} reminder notification`);
      return { sent };
    } catch (error) {
      this.logger.error(
        `❌ შეცდომა reminder notifications cron job-ში: ${(error as Error).message}`,
      );
      return { sent: 0 };
    } finally {
      // Release lock
      this.isSendingReminders = false;
    }
  }

  /**
   * Cron job: ჯარიმების push შეხსენება დღეში 2-ჯერ (თბილისის დროით)
   * - 10:00 (დილა)
   * - 20:00 (საღამო)
   *
   * აგზავნის მხოლოდ იმ მომხმარებლებზე, ვისაც აქტიური fines-მანქანა აქვს.
   * slot დუბლირება იზღუდება FinesDailyReminder კოლექციით (ymd + morning/evening).
   */
  @Cron('0 10,20 * * *', {
    name: 'send-fines-reminder-notifications',
    timeZone: 'Asia/Tbilisi',
  })
  async sendFinesReminderNotifications(): Promise<{ sent: number }> {
    try {
      const now = Date.now();
      const tbNow = this.getTbilisiYmdAndMinutes(new Date(now));
      const ymd = tbNow.ymd;
      const hour = Math.floor(tbNow.minutesSinceMidnight / 60);
      const slot = hour < 15 ? 'morning' : 'evening';

      this.logger.log(
        `🚨 [FINES REMINDER] დაწყებულია fines push reminder (${ymd}, ${slot})`,
      );

      const rows = await this.finesVehicleModel
        .aggregate([
          { $match: { isActive: true } },
          {
            $group: {
              _id: '$userId',
              vehiclesCount: { $sum: 1 },
            },
          },
          { $project: { _id: 0, userId: '$_id', vehiclesCount: 1 } },
          { $limit: 2000 },
        ])
        .exec();

      if (!rows.length) {
        this.logger.log(
          `ℹ️ [FINES REMINDER] აქტიური fines მანქანები ვერ მოიძებნა (${ymd}, ${slot})`,
        );
        return { sent: 0 };
      }

      let sent = 0;
      for (const row of rows) {
        const userId = String(row.userId || '').trim();
        const vehiclesCount = Number(row.vehiclesCount || 0);
        if (!userId || vehiclesCount <= 0) continue;

        try {
          const alreadySent = await this.finesDailyReminderModel
            .findOne({
              userId,
              ymd,
              slots: slot,
            })
            .lean()
            .exec();
          if (alreadySent) continue;

          const title =
            slot === 'morning'
              ? '🌤️ დილის შეხსენება — ჯარიმები'
              : '🌙 საღამოს შეხსენება — ჯარიმები';
          const body =
            vehiclesCount === 1
              ? 'ჯარიმების შეხსენება გაქვს 1 მანქანაზე ჩართული — გადაამოწმე ახალი ჯარიმები.'
              : `${vehiclesCount} მანქანა გაქვს მონიტორინგზე — გადაამოწმე ახალი ჯარიმები.`;

          await this.notificationsService.sendPushToTargets(
            [{ userId }],
            {
              title,
              body,
              data: {
                type: 'garage_fines_reminder',
                screen: 'Fines',
                slot,
                ymd,
                vehiclesCount: String(vehiclesCount),
              },
              sound: 'default',
              badge: 1,
            },
            'system',
          );

          await this.finesDailyReminderModel
            .updateOne(
              { userId, ymd },
              {
                $setOnInsert: { userId, ymd },
                $addToSet: { slots: slot },
              },
              { upsert: true },
            )
            .exec();

          sent += 1;
        } catch (error) {
          this.logger.warn(
            `⚠️ [FINES REMINDER] user ${userId}-ზე გაგზავნა ვერ მოხერხდა: ${(error as Error).message}`,
          );
        }
      }

      this.logger.log(
        `✅ [FINES REMINDER] დასრულდა: გაიგზავნა ${sent} მომხმარებელზე (${ymd}, ${slot})`,
      );
      return { sent };
    } catch (error) {
      this.logger.error(
        `❌ [FINES REMINDER] cron შეცდომა: ${(error as Error).message}`,
      );
      return { sent: 0 };
    }
  }

  /**
   * Helper method: გაგზავნის reminder notification-ს
   */
  private async sendReminderNotification(
    reminder: any,
    title: string,
    body: string,
    now: number,
    todayStrTbilisi: string,
    slotKey: string,
  ): Promise<void> {
    // მოძებნა მანქანის ინფორმაცია
    const car = await this.carModel.findById(reminder.carId).lean().exec();
    const carLabel = car
      ? `${car.make || ''} ${car.model || ''}`.trim() || 'მანქანა'
      : 'მანქანა';

    // Push notification-ის გაგზავნა
    await this.notificationsService.sendPushToTargets(
      [{ userId: String(reminder.userId) }],
      {
        title,
        body,
        data: {
          type: 'garage_reminder',
          screen: 'Garage',
          reminderId: String((reminder as any)._id || reminder.id || ''),
          carId: String(reminder.carId),
          reminderType: reminder.type,
        },
        sound: 'default',
        badge: 1,
      },
      'system',
    );

    const prevDate = (reminder as any).notificationSentDate as
      | string
      | undefined;
    const prevSlotsRaw = String(
      (reminder as any).notificationSentSlotsToday || '',
    );
    const slotsArr =
      prevDate === todayStrTbilisi
        ? prevSlotsRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    if (!slotsArr.includes(slotKey)) slotsArr.push(slotKey);

    await this.reminderModel.updateOne(
      { _id: (reminder as any)._id },
      {
        $set: {
          notificationSentAt: now,
          notificationSentDate: todayStrTbilisi,
          notificationSentSlotsToday: slotsArr.join(','),
        },
      },
    );

    this.logger.log(
      `✅ Notification გაიგზავნა reminder-ისთვის: ${reminder.title} (${carLabel})`,
    );
  }

  /**
   * Helper method: შეამოწმებს recurring reminder-ისთვის უნდა გაიგზავნოს notification თუ არა
   */
  private shouldSendRecurringReminder(
    reminder: any,
    now: number,
    todayStr: string,
  ): { shouldSend: boolean; title: string; body: string; slotKey: string } {
    const empty = { shouldSend: false, title: '', body: '', slotKey: '' };

    if (reminder.recurringInterval === 'none' || !reminder.recurringInterval) {
      return empty;
    }

    if (!this.recurringMatchesCalendarDay(reminder, now)) {
      return empty;
    }

    if (reminder.startDate) {
      const startMs = this.tbilisiDayStartUtcMs(
        String(reminder.startDate).slice(0, 10),
      );
      if (now < startMs) return empty;
    }

    if (reminder.endDate) {
      const endMs = this.tbilisiDayEndUtcMs(
        String(reminder.endDate).slice(0, 10),
      );
      if (now > endMs) return empty;
    }

    const trySlot = (
      hhmmRaw: string | undefined,
      slotSuffix: string,
      title: string,
      bodyLine: string,
    ) => {
      const clock =
        this.normalizeReminderClock(hhmmRaw) ||
        this.normalizeReminderClock(reminder.reminderTime) ||
        '09:00';
      const slotKey = `rec_${reminder.recurringInterval}_${slotSuffix}_${clock}`;
      if (this.wasReminderSlotSentToday(reminder, todayStr, slotKey)) {
        return empty;
      }
      const targetMs = this.getTbilisiTodayAtClockUtcMs(now, clock);
      if (!this.shouldFireAtTargetOrCatchup(now, targetMs, todayStr)) {
        return empty;
      }
      return {
        shouldSend: true,
        title,
        body: bodyLine,
        slotKey,
      };
    };

    if (reminder.recurringInterval === 'daily') {
      if (reminder.reminderTime) {
        const r = trySlot(
          reminder.reminderTime,
          't1',
          'MARTE: ⏰ შეხსენება',
          `${reminder.title} • ${reminder.reminderTime}`,
        );
        if (r.shouldSend) return r;
      }
      if (reminder.reminderTime2) {
        const r = trySlot(
          reminder.reminderTime2,
          't2',
          '⏰ შეხსენება',
          `${reminder.title} • ${reminder.reminderTime2}`,
        );
        if (r.shouldSend) return r;
      }
      return empty;
    }

    if (
      reminder.recurringInterval === 'weekly' ||
      reminder.recurringInterval === 'monthly' ||
      reminder.recurringInterval === 'yearly'
    ) {
      const intervalText =
        reminder.recurringInterval === 'weekly'
          ? 'ყოველ კვირაში'
          : reminder.recurringInterval === 'monthly'
            ? 'ყოველ თვეში'
            : 'ყოველ წელს';
      return trySlot(
        reminder.reminderTime,
        'wm',
        '⏰ შეხსენება',
        `${reminder.title} • ${intervalText}`,
      );
    }

    return empty;
  }

  // Service History Methods
  async createServiceHistory(
    userId: string,
    createDto: CreateServiceHistoryDto,
  ): Promise<any> {
    const serviceHistory = new this.serviceHistoryModel({
      ...createDto,
      userId,
      date: new Date(createDto.date),
      warrantyUntil: createDto.warrantyUntil
        ? new Date(createDto.warrantyUntil)
        : undefined,
    });

    const saved = await serviceHistory.save();
    const plain = this.toPlain(saved);

    // Update car's lastService and mileage if this is the latest service
    const car = await this.carModel.findById(createDto.carId).exec();
    if (car) {
      const latestService = await this.serviceHistoryModel
        .findOne({ carId: createDto.carId, isActive: true })
        .sort({ date: -1 })
        .exec();

      if (latestService && String(latestService._id) === String(saved._id)) {
        await this.carModel.findByIdAndUpdate(createDto.carId, {
          lastService: new Date(createDto.date),
          mileage: createDto.mileage,
        });
      }
    }

    return plain;
  }

  async getServiceHistories(userId: string, carId?: string): Promise<any[]> {
    const query: any = { userId, isActive: true };
    if (carId) {
      query.carId = carId;
    }

    const services = await this.serviceHistoryModel
      .find(query)
      .sort({ date: -1 })
      .exec();

    return services.map((s) => this.toPlain(s));
  }

  async getServiceHistory(userId: string, id: string): Promise<any> {
    const service = await this.serviceHistoryModel
      .findOne({ _id: id, userId, isActive: true })
      .exec();

    if (!service) {
      throw new NotFoundException('Service history not found');
    }

    return this.toPlain(service);
  }

  async updateServiceHistory(
    userId: string,
    id: string,
    updateDto: UpdateServiceHistoryDto,
  ): Promise<any> {
    const updateData: any = { ...updateDto };
    if (updateDto.date) {
      updateData.date = new Date(updateDto.date);
    }
    if (updateDto.warrantyUntil) {
      updateData.warrantyUntil = new Date(updateDto.warrantyUntil);
    }

    const service = await this.serviceHistoryModel
      .findOneAndUpdate({ _id: id, userId, isActive: true }, updateData, {
        new: true,
      })
      .exec();

    if (!service) {
      throw new NotFoundException('Service history not found');
    }

    return this.toPlain(service);
  }

  async deleteServiceHistory(userId: string, id: string): Promise<void> {
    const service = await this.serviceHistoryModel
      .findOneAndUpdate(
        { _id: id, userId, isActive: true },
        { isActive: false },
        { new: true },
      )
      .exec();

    if (!service) {
      throw new NotFoundException('Service history not found');
    }
  }
}
