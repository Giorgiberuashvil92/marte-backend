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
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { CreateFuelEntryDto } from './dto/create-fuel-entry.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class GarageService {
  private readonly logger = new Logger(GarageService.name);

  constructor(
    @InjectModel(Car.name) private carModel: Model<CarDocument>,
    @InjectModel(Reminder.name) private reminderModel: Model<ReminderDocument>,
    @InjectModel(FuelEntry.name)
    private fuelEntryModel: Model<FuelEntryDocument>,
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
   * გაშვება: დილით 9:00 და საღამოს 18:00 (Asia/Tbilisi timezone)
   * ლოგიკა: იგზავნება notification, თუ reminderDate არის:
   * - დღეს (0 დღე) - დილით 9:00 და საღამოს 18:00
   * - 1 დღეში - დილით 9:00 და საღამოს 18:00
   * - 3 დღეში (urgent reminders-ისთვის) - დილით 9:00 და საღამოს 18:00
   */
  @Cron('0 9,18 * * *', {
    name: 'send-reminder-notifications',
    timeZone: 'Asia/Tbilisi',
  })
  async sendReminderNotifications(testMode = false): Promise<{ sent: number }> {
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
      const currentHour = new Date().getHours();

      for (const reminder of candidates) {
        try {
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
          const sentInMorning =
            alreadySentToday &&
            (reminder as any).notificationSentAt &&
            (reminder as any).notificationSentAt <
              todayStart + 12 * 60 * 60 * 1000;

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
          // დღეს (0 დღე) - იგზავნება დილით 9:00 და საღამოს 18:00
          else if (diffDays === 0) {
            if (currentHour === 9 && !alreadySentToday) {
              shouldSend = true;
              notificationTitle = '⏰ შეხსენება დღეს';
              notificationBody = `${reminder.title} • დღეს უნდა შესრულდეს`;
            } else if (
              currentHour === 18 &&
              (sentInMorning || !alreadySentToday)
            ) {
              shouldSend = true;
              notificationTitle = '⏰ შეხსენება დღეს';
              notificationBody = `${reminder.title} • დღეს უნდა შესრულდეს`;
            }
          }
          // 1 დღეში - იგზავნება დილით 9:00 და საღამოს 18:00
          else if (diffDays === 1) {
            if (currentHour === 9 && !alreadySentToday) {
              shouldSend = true;
              notificationTitle = '📅 შეხსენება ხვალ';
              notificationBody = `${reminder.title} • ხვალ უნდა შესრულდეს`;
            } else if (
              currentHour === 18 &&
              (sentInMorning || !alreadySentToday)
            ) {
              shouldSend = true;
              notificationTitle = '📅 შეხსენება ხვალ';
              notificationBody = `${reminder.title} • ხვალ უნდა შესრულდეს`;
            }
          }
          // 3 დღეში (urgent reminders-ისთვის) - იგზავნება დილით 9:00 და საღამოს 18:00
          else if (diffDays === 3 && reminder.isUrgent) {
            if (currentHour === 9 && !alreadySentToday) {
              shouldSend = true;
              notificationTitle = '🚨 გადაუდებელი შეხსენება';
              notificationBody = `${reminder.title} • 3 დღეში უნდა შესრულდეს`;
            } else if (
              currentHour === 18 &&
              (sentInMorning || !alreadySentToday)
            ) {
              shouldSend = true;
              notificationTitle = '🚨 გადაუდებელი შეხსენება';
              notificationBody = `${reminder.title} • 3 დღეში უნდა შესრულდეს`;
            }
          }

          if (shouldSend) {
            // მოძებნა მანქანის ინფორმაცია
            const car = await this.carModel
              .findById(reminder.carId)
              .lean()
              .exec();
            const carLabel = car
              ? `${car.make || ''} ${car.model || ''}`.trim() || 'მანქანა'
              : 'მანქანა';

            // Push notification-ის გაგზავნა
            await this.notificationsService.sendPushToTargets(
              [{ userId: String(reminder.userId) }],
              {
                title: notificationTitle,
                body: notificationBody,
                data: {
                  type: 'garage_reminder',
                  screen: 'Garage',
                  reminderId: String(
                    (reminder as any)._id || reminder.id || '',
                  ),
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

            sent += 1;
            this.logger.log(
              `✅ Notification გაიგზავნა reminder-ისთვის: ${reminder.title} (${carLabel})`,
            );
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
    }
  }
}
