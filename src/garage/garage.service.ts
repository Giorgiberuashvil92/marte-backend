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
  private isSendingReminders = false; // Lock mechanism to prevent duplicate executions

  constructor(
    @InjectModel(Car.name) private carModel: Model<CarDocument>,
    @InjectModel(Reminder.name) private reminderModel: Model<ReminderDocument>,
    @InjectModel(FuelEntry.name)
    private fuelEntryModel: Model<FuelEntryDocument>,
    @InjectModel(ServiceHistory.name)
    private serviceHistoryModel: Model<ServiceHistoryDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private notificationsService: NotificationsService,
  ) {}

  private toPlain<T = any>(doc: any): T {
    return typeof doc?.toJSON === 'function' ? (doc.toJSON() as T) : (doc as T);
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
   * ლოგიკა: იგზავნება notification, თუ reminderDate არის:
   * - დღეს (0 დღე) - როცა დრო მოდის
   * - 1 დღეში - როცა დრო მოდის
   * - 3 დღეში (urgent reminders-ისთვის) - როცა დრო მოდის
   * - Recurring reminders-ისთვის - recurringInterval-ის მიხედვით
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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.getTime();

      const todayEnd = todayStart + 24 * 60 * 60 * 1000;

      const threeDaysStart = todayEnd + 2 * 24 * 60 * 60 * 1000;
      const threeDaysEnd = threeDaysStart + 24 * 60 * 60 * 1000;

      const todayStr = today.toISOString().split('T')[0];

      const candidates = await this.reminderModel
        .find({
          isActive: true,
          isCompleted: false,
          $or: [
            { notificationSentAt: { $exists: false } },
            { notificationSentDate: { $ne: todayStr } },
            {
              notificationSentDate: todayStr,
              notificationSentAt: { $lt: todayStart + 12 * 60 * 60 * 1000 }, // დილით გაიგზავნა (12 საათამდე)
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
      const currentTime = new Date();
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();

      for (const reminder of candidates) {
        try {
          // Recurring reminder-ებისთვის
          if (
            reminder.recurringInterval &&
            reminder.recurringInterval !== 'none'
          ) {
            const shouldSendRecurring = this.shouldSendRecurringReminder(
              reminder,
              now,
              todayStr,
            );
            if (shouldSendRecurring.shouldSend) {
              await this.sendReminderNotification(
                reminder,
                shouldSendRecurring.title,
                shouldSendRecurring.body,
                now,
                todayStr,
              );
              sent += 1;
            }
            continue;
          }

          // ერთჯერადი reminder-ებისთვის
          const reminderDate = new Date(reminder.reminderDate);
          const reminderTimestamp = reminderDate.getTime();
          const diffMs = reminderTimestamp - now;
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          let shouldSend = false;
          let notificationTitle = '';
          let notificationBody = '';

          // შემოწმება, რომ დღეს უკვე გაიგზავნა თუ არა notification
          const reminderSentDate = (reminder as any).notificationSentDate;
          const alreadySentToday = reminderSentDate === todayStr;

          // Test mode: გაიგზავნოს ნებისმიერ დროს
          if (testMode) {
            if (diffDays === 0) {
              shouldSend = true;
              notificationTitle = '⏰ შეხსენება დღეს';
              notificationBody = `${reminder.title} • დღეს უნდა შესრულდეს`;
            } else if (diffDays === 1) {
              shouldSend = true;
              notificationTitle = '📅 შეხსენება ხვალ';
              notificationBody = `${reminder.title} • ხვალ უნდა შესრულდეს`;
            } else if (diffDays === 3 && reminder.isUrgent) {
              shouldSend = true;
              notificationTitle = '🚨 გადაუდებელი შეხსენება';
              notificationBody = `${reminder.title} • 3 დღეში უნდა შესრულდეს`;
            }
          }
          // დღეს (0 დღე) - შემოწმება reminderTime-ის მიხედვით
          else if (diffDays === 0) {
            if (reminder.reminderTime) {
              const [hours, minutes] = reminder.reminderTime
                .split(':')
                .map(Number);
              const reminderTime = new Date(reminderDate);
              reminderTime.setHours(hours, minutes, 0, 0);
              const reminderTimeMs = reminderTime.getTime();

              // გაიგზავნოს 5 წუთით ადრე
              const fiveMinutesBefore = reminderTimeMs - 5 * 60 * 1000;
              const fiveMinutesAfter = reminderTimeMs + 5 * 60 * 1000;

              if (
                now >= fiveMinutesBefore &&
                now <= fiveMinutesAfter &&
                !alreadySentToday
              ) {
                shouldSend = true;
                notificationTitle = '⏰ შეხსენება დღეს';
                notificationBody = `${reminder.title} • დღეს ${reminder.reminderTime}-ზე`;
              }
            } else {
              // თუ reminderTime არ არის, გაიგზავნოს დილით 9:00
              if (currentHour === 9 && currentMinute < 5 && !alreadySentToday) {
                shouldSend = true;
                notificationTitle = '⏰ შეხსენება დღეს';
                notificationBody = `${reminder.title} • დღეს უნდა შესრულდეს`;
              }
            }
          }
          // 1 დღეში - გაიგზავნოს დილით 9:00
          else if (diffDays === 1) {
            if (currentHour === 9 && currentMinute < 5 && !alreadySentToday) {
              shouldSend = true;
              notificationTitle = '📅 შეხსენება ხვალ';
              notificationBody = `${reminder.title} • ხვალ უნდა შესრულდეს`;
            }
          }
          // 3 დღეში (urgent reminders-ისთვის) - გაიგზავნოს დილით 9:00
          else if (diffDays === 3 && reminder.isUrgent) {
            if (currentHour === 9 && currentMinute < 5 && !alreadySentToday) {
              shouldSend = true;
              notificationTitle = '🚨 გადაუდებელი შეხსენება';
              notificationBody = `${reminder.title} • 3 დღეში უნდა შესრულდეს`;
            }
          }

          if (shouldSend) {
            await this.sendReminderNotification(
              reminder,
              notificationTitle,
              notificationBody,
              now,
              todayStr,
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
   * Helper method: გაგზავნის reminder notification-ს
   */
  private async sendReminderNotification(
    reminder: any,
    title: string,
    body: string,
    now: number,
    todayStr: string,
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

    // მონიშვნა, რომ notification გაიგზავნა
    await this.reminderModel.updateOne(
      { _id: (reminder as any)._id },
      {
        $set: {
          notificationSentAt: now,
          notificationSentDate: todayStr,
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
  ): { shouldSend: boolean; title: string; body: string } {
    const reminderSentDate = (reminder as any).notificationSentDate;
    const alreadySentToday = reminderSentDate === todayStr;

    if (alreadySentToday) {
      return { shouldSend: false, title: '', body: '' };
    }

    // შემოწმება startDate და endDate
    if (reminder.startDate) {
      const startDate = new Date(reminder.startDate);
      startDate.setHours(0, 0, 0, 0);
      if (now < startDate.getTime()) {
        return { shouldSend: false, title: '', body: '' };
      }
    }

    if (reminder.endDate) {
      const endDate = new Date(reminder.endDate);
      endDate.setHours(23, 59, 59, 999);
      if (now > endDate.getTime()) {
        return { shouldSend: false, title: '', body: '' };
      }
    }

    // Daily reminders - შემოწმება reminderTime-ის მიხედვით
    if (reminder.recurringInterval === 'daily') {
      if (reminder.reminderTime) {
        const [hours, minutes] = reminder.reminderTime.split(':').map(Number);
        const currentTime = new Date(now);
        const reminderTime = new Date(currentTime);
        reminderTime.setHours(hours, minutes, 0, 0);
        const reminderTimeMs = reminderTime.getTime();

        // გაიგზავნოს 5 წუთით ადრე
        const fiveMinutesBefore = reminderTimeMs - 5 * 60 * 1000;
        const fiveMinutesAfter = reminderTimeMs + 5 * 60 * 1000;

        if (now >= fiveMinutesBefore && now <= fiveMinutesAfter) {
          return {
            shouldSend: true,
            title: 'MARTE: ⏰ შეხსენება',
            body: `${reminder.title} • ${reminder.reminderTime}`,
          };
        }
      }

      // მეორე დრო (reminderTime2) - დღეში 2 ჯერ
      if (reminder.reminderTime2) {
        const [hours, minutes] = reminder.reminderTime2.split(':').map(Number);
        const currentTime = new Date(now);
        const reminderTime = new Date(currentTime);
        reminderTime.setHours(hours, minutes, 0, 0);
        const reminderTimeMs = reminderTime.getTime();

        const fiveMinutesBefore = reminderTimeMs - 5 * 60 * 1000;
        const fiveMinutesAfter = reminderTimeMs + 5 * 60 * 1000;

        if (now >= fiveMinutesBefore && now <= fiveMinutesAfter) {
          return {
            shouldSend: true,
            title: '⏰ შეხსენება',
            body: `${reminder.title} • ${reminder.reminderTime2}`,
          };
        }
      }
    }

    // Weekly, Monthly, Yearly - გაიგზავნოს დილით 9:00
    if (
      reminder.recurringInterval === 'weekly' ||
      reminder.recurringInterval === 'monthly' ||
      reminder.recurringInterval === 'yearly'
    ) {
      const currentTime = new Date(now);
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();

      if (currentHour === 9 && currentMinute < 5) {
        const intervalText =
          reminder.recurringInterval === 'weekly'
            ? 'ყოველ კვირაში'
            : reminder.recurringInterval === 'monthly'
              ? 'ყოველ თვეში'
              : 'ყოველ წელს';

        return {
          shouldSend: true,
          title: '⏰ შეხსენება',
          body: `${reminder.title} • ${intervalText}`,
        };
      }
    }

    return { shouldSend: false, title: '', body: '' };
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
