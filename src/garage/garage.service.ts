/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Car, CarDocument } from '../schemas/car.schema';
import { Reminder, ReminderDocument } from '../schemas/reminder.schema';
import { FuelEntry, FuelEntryDocument } from '../schemas/fuel-entry.schema';
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { CreateFuelEntryDto } from './dto/create-fuel-entry.dto';

@Injectable()
export class GarageService {
  constructor(
    @InjectModel(Car.name) private carModel: Model<CarDocument>,
    @InjectModel(Reminder.name) private reminderModel: Model<ReminderDocument>,
    @InjectModel(FuelEntry.name)
    private fuelEntryModel: Model<FuelEntryDocument>,
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
}
