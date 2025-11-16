import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  Query,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { GarageService } from './garage.service';
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { CreateFuelEntryDto } from './dto/create-fuel-entry.dto';

@Controller('garage')
export class GarageController {
  constructor(private readonly garageService: GarageService) {}

  // მანქანების API
  @Post('cars')
  async createCar(
    @Request() req: ExpressRequest,
    @Body() createCarDto: CreateCarDto,
  ) {
    const userId = (req.headers['x-user-id'] as string) || 'demo-user';
    return this.garageService.createCar(userId, createCarDto);
  }

  @Get('cars')
  async findAllCars(
    @Request() req: ExpressRequest,
    @Query('userId') userIdQuery?: string,
  ) {
    const userId =
      userIdQuery || (req.headers['x-user-id'] as string) || 'demo-user';
    return this.garageService.findAllCars(userId);
  }

  @Get('cars/:id')
  async findOneCar(@Request() req: ExpressRequest, @Param('id') id: string) {
    const userId = (req.headers['x-user-id'] as string) || 'demo-user';
    return this.garageService.findOneCar(userId, id);
  }

  @Patch('cars/:id')
  async updateCar(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Body() updateCarDto: UpdateCarDto,
  ) {
    const userId = (req.headers['x-user-id'] as string) || 'demo-user';
    return this.garageService.updateCar(userId, id, updateCarDto);
  }

  @Delete('cars/:id')
  async removeCar(@Request() req: ExpressRequest, @Param('id') id: string) {
    const userId = (req.headers['x-user-id'] as string) || 'demo-user';
    return this.garageService.removeCar(userId, id);
  }

  // შეხსენებების API
  @Post('reminders')
  async createReminder(
    @Request() req: ExpressRequest,
    @Body() createReminderDto: CreateReminderDto,
  ) {
    const userId = (req.headers['x-user-id'] as string) || 'demo-user';
    return this.garageService.createReminder(userId, createReminderDto);
  }

  @Get('reminders')
  async findAllReminders(@Request() req: ExpressRequest) {
    const userId = (req.headers['x-user-id'] as string) || 'demo-user';
    return this.garageService.findAllReminders(userId);
  }

  @Get('reminders/car/:carId')
  async findRemindersByCar(
    @Request() req: ExpressRequest,
    @Param('carId') carId: string,
  ) {
    const userId = (req.headers['x-user-id'] as string) || 'demo-user';
    return this.garageService.findRemindersByCar(userId, carId);
  }

  @Get('reminders/:id')
  async findOneReminder(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
  ) {
    const userId = (req.headers['x-user-id'] as string) || 'demo-user';
    return this.garageService.findOneReminder(userId, id);
  }

  @Patch('reminders/:id')
  async updateReminder(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Body() updateReminderDto: UpdateReminderDto,
  ) {
    const userId = (req.headers['x-user-id'] as string) || 'demo-user';
    return this.garageService.updateReminder(userId, id, updateReminderDto);
  }

  @Delete('reminders/:id')
  async removeReminder(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
  ) {
    const userId = (req.headers['x-user-id'] as string) || 'demo-user';
    return this.garageService.removeReminder(userId, id);
  }

  @Patch('reminders/:id/complete')
  async markReminderCompleted(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
  ) {
    const userId = (req.headers['x-user-id'] as string) || 'demo-user';
    return this.garageService.markReminderCompleted(userId, id);
  }

  // სტატისტიკა
  @Get('stats')
  async getGarageStats(@Request() req: ExpressRequest) {
    const userId = (req.headers['x-user-id'] as string) || 'demo-user';
    return this.garageService.getGarageStats(userId);
  }

  // საწვავის ლოგები
  @Post('fuel')
  async createFuelEntry(
    @Request() req: ExpressRequest,
    @Body() dto: CreateFuelEntryDto,
  ) {
    const userId = (req.headers['x-user-id'] as string) || 'demo-user';
    return await this.garageService.createFuelEntry(userId, dto);
  }

  @Get('fuel')
  async listFuelEntries(@Request() req: ExpressRequest) {
    const userId = (req.headers['x-user-id'] as string) || 'demo-user';
    return await this.garageService.listFuelEntries(userId);
  }

  @Get('fuel/car/:carId')
  async listFuelEntriesByCar(
    @Request() req: ExpressRequest,
    @Param('carId') carId: string,
  ) {
    const userId = (req.headers['x-user-id'] as string) || 'demo-user';
    return await this.garageService.listFuelEntriesByCar(userId, carId);
  }
}
