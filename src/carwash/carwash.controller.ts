import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Logger,
} from '@nestjs/common';
import { CarwashService } from './carwash.service';
import { CreateCarwashBookingDto } from './dto/create-carwash-booking.dto';
import { UpdateCarwashBookingDto } from './dto/update-carwash-booking.dto';
import { CreateCarwashLocationDto } from './dto/create-carwash-location.dto';
import { UpdateCarwashLocationDto } from './dto/update-carwash-location.dto';

@Controller('carwash')
export class CarwashController {
  private readonly logger = new Logger(CarwashController.name);
  constructor(private readonly carwashService: CarwashService) {}

  // Booking endpoints
  @Post('bookings')
  createBooking(@Body() createBookingDto: CreateCarwashBookingDto) {
    this.logger.log(
      `createBooking payload: ${JSON.stringify(createBookingDto)}`,
    );
    return this.carwashService.createBooking(createBookingDto);
  }

  @Get('bookings')
  findAllBookings(@Query('userId') userId?: string) {
    return this.carwashService.findAllBookings(userId);
  }

  @Get('bookings/:id')
  findBookingById(@Param('id') id: string) {
    return this.carwashService.findBookingById(id);
  }

  @Patch('bookings/:id')
  updateBooking(
    @Param('id') id: string,
    @Body() updateBookingDto: UpdateCarwashBookingDto,
  ) {
    this.logger.log(
      `updateBooking id=${id} payload: ${JSON.stringify(updateBookingDto)}`,
    );
    return this.carwashService.updateBooking(id, updateBookingDto);
  }

  @Patch('bookings/:id/cancel')
  cancelBooking(@Param('id') id: string) {
    this.logger.log(`cancelBooking id=${id}`);
    return this.carwashService.cancelBooking(id);
  }

  @Patch('bookings/:id/confirm')
  confirmBooking(@Param('id') id: string) {
    this.logger.log(`confirmBooking id=${id}`);
    return this.carwashService.confirmBooking(id);
  }

  @Patch('bookings/:id/start')
  startBooking(@Param('id') id: string) {
    this.logger.log(`startBooking id=${id}`);
    return this.carwashService.startBooking(id);
  }

  @Patch('bookings/:id/complete')
  completeBooking(@Param('id') id: string) {
    this.logger.log(`completeBooking id=${id}`);
    return this.carwashService.completeBooking(id);
  }

  @Delete('bookings/:id')
  deleteBooking(@Param('id') id: string) {
    this.logger.log(`deleteBooking id=${id}`);
    return this.carwashService.deleteBooking(id);
  }

  @Get('locations/:locationId/bookings')
  getBookingsByLocation(@Param('locationId') locationId: string) {
    return this.carwashService.getBookingsByLocation(locationId);
  }

  @Get('bookings/date/:date')
  getBookingsByDate(@Param('date') date: string) {
    return this.carwashService.getBookingsByDate(date);
  }

  // Location endpoints
  @Post('locations')
  async createLocation(@Body() createLocationDto: CreateCarwashLocationDto) {
    return this.carwashService.createLocation(createLocationDto);
  }

  @Get('locations')
  async findAllLocations() {
    return this.carwashService.findAllLocations();
  }

  @Get('locations/popular')
  async getPopularLocations(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.carwashService.getPopularLocations(limitNum);
  }

  @Get('locations/:id')
  async findLocationById(@Param('id') id: string) {
    return this.carwashService.findLocationById(id);
  }

  @Get('locations/owner/:ownerId')
  async findLocationsByOwner(@Param('ownerId') ownerId: string) {
    return this.carwashService.findLocationsByOwner(ownerId);
  }

  @Patch('locations/:id')
  async updateLocation(
    @Param('id') id: string,
    @Body() updateLocationDto: UpdateCarwashLocationDto,
  ) {
    return this.carwashService.updateLocation(id, updateLocationDto);
  }

  @Delete('locations/:id')
  async deleteLocation(@Param('id') id: string) {
    return this.carwashService.deleteLocation(id);
  }

  // Services endpoints
  @Get('locations/:id/services')
  async getServices(@Param('id') id: string) {
    return this.carwashService.getServices(id);
  }

  @Patch('locations/:id/services')
  async updateServices(@Param('id') id: string, @Body() services: any[]) {
    return this.carwashService.updateServices(id, services);
  }

  // Time slots endpoints
  @Patch('locations/:id/time-slots-config')
  async updateTimeSlotsConfig(@Param('id') id: string, @Body() config: any) {
    return this.carwashService.updateTimeSlotsConfig(id, config);
  }

  @Get('locations/:id/available-slots')
  async getAvailableSlots(
    @Param('id') id: string,
    @Query('date') date?: string,
  ) {
    return this.carwashService.getAvailableSlots(id, date);
  }

  @Post('locations/:id/available-slots')
  async updateAvailableSlots(@Param('id') id: string, @Body() daySlots: any[]) {
    return this.carwashService.updateAvailableSlots(id, daySlots);
  }

  @Post('locations/:id/book-slot')
  async bookTimeSlot(
    @Param('id') id: string,
    @Body() slotData: { date: string; time: string; userId: string },
  ) {
    this.logger.log(
      `bookTimeSlot id=${id} payload: ${JSON.stringify(slotData)}`,
    );
    return this.carwashService.bookTimeSlot(
      id,
      slotData.date,
      slotData.time,
      slotData.userId,
    );
  }

  @Post('locations/:id/release-slot')
  async releaseTimeSlot(
    @Param('id') id: string,
    @Body() slotData: { date: string; time: string },
  ) {
    this.logger.log(
      `releaseTimeSlot id=${id} payload: ${JSON.stringify(slotData)}`,
    );
    return this.carwashService.releaseTimeSlot(
      id,
      slotData.date,
      slotData.time,
    );
  }

  // Real-time status endpoints
  @Get('locations/:id/status')
  async getRealTimeStatus(@Param('id') id: string) {
    return this.carwashService.getRealTimeStatus(id);
  }

  @Patch('locations/:id/status')
  async updateRealTimeStatus(@Param('id') id: string, @Body() status: any) {
    return this.carwashService.updateRealTimeStatus(id, status);
  }

  @Patch('locations/:id/toggle-open')
  async toggleOpenStatus(@Param('id') id: string) {
    return this.carwashService.toggleOpenStatus(id);
  }

  @Patch('locations/:id/wait-time')
  async updateWaitTime(
    @Param('id') id: string,
    @Body() waitTime: { waitTime: number },
  ) {
    return this.carwashService.updateWaitTime(id, waitTime.waitTime);
  }
}
