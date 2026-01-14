import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CarRentalService, GetRentalCarsOptions } from './car-rental.service';
import { CarRental } from '../schemas/car-rental.schema';

@Controller('car-rental')
export class CarRentalController {
  private readonly logger = new Logger(CarRentalController.name);

  constructor(private readonly carRentalService: CarRentalService) {}

  /**
   * GET /car-rental
   * მიიღე ყველა გასაქირავებელი მანქანა ფილტრებით
   */
  @Get()
  async getAllRentalCars(
    @Query('location') location?: string,
    @Query('category') category?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('transmission') transmission?: string,
    @Query('fuelType') fuelType?: string,
    @Query('seats') seats?: string,
    @Query('sortBy') sortBy?: 'price' | 'rating' | 'date',
    @Query('order') order?: 'asc' | 'desc',
    @Query('limit') limit?: string,
    @Query('available') available?: string,
  ): Promise<CarRental[]> {
    try {
      const options: GetRentalCarsOptions = {
        location,
        category,
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        transmission,
        fuelType,
        seats: seats ? parseInt(seats, 10) : undefined,
        sortBy: sortBy || 'date',
        order: order || 'desc',
        limit: limit ? parseInt(limit, 10) : 50,
        available: available !== undefined ? available === 'true' : undefined,
      };

      return await this.carRentalService.getAllRentalCars(options);
    } catch (error) {
      this.logger.error('❌ Error fetching rental cars:', error);
      throw new HttpException(
        'Failed to fetch rental cars',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /car-rental/filters
   * მიიღე ხელმისაწვდომი ფილტრები (categories, locations, brands, etc.)
   */
  @Get('filters')
  async getAvailableFilters() {
    try {
      return await this.carRentalService.getAvailableFilters();
    } catch (error) {
      this.logger.error('❌ Error fetching filters:', error);
      throw new HttpException(
        'Failed to fetch filters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /car-rental/popular
   * მიიღე პოპულარული გასაქირავებელი მანქანები
   */
  @Get('popular')
  async getPopularRentalCars(
    @Query('limit') limit?: string,
  ): Promise<CarRental[]> {
    try {
      const parsedLimit = limit ? parseInt(limit, 10) : 10;
      return await this.carRentalService.getPopularRentalCars(parsedLimit);
    } catch (error) {
      this.logger.error('❌ Error fetching popular rental cars:', error);
      throw new HttpException(
        'Failed to fetch popular rental cars',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /car-rental/recent
   * მიიღე ბოლოს დამატებული გასაქირავებელი მანქანები
   */
  @Get('recent')
  async getRecentRentalCars(
    @Query('limit') limit?: string,
  ): Promise<CarRental[]> {
    try {
      const parsedLimit = limit ? parseInt(limit, 10) : 10;
      return await this.carRentalService.getRecentRentalCars(parsedLimit);
    } catch (error) {
      this.logger.error('❌ Error fetching recent rental cars:', error);
      throw new HttpException(
        'Failed to fetch recent rental cars',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /car-rental/:id
   * მიიღე ერთი მანქანა ID-ს მიხედვით
   */
  @Get(':id')
  async getRentalCarById(@Param('id') id: string): Promise<CarRental> {
    try {
      return await this.carRentalService.getRentalCarById(id);
    } catch (error) {
      this.logger.error(`❌ Error fetching rental car ${id}:`, error);
      throw new HttpException(
        error.message || 'Rental car not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * POST /car-rental
   * შექმენი ახალი გასაქირავებელი მანქანა
   */
  @Post()
  async createRentalCar(@Body() data: Partial<CarRental>): Promise<CarRental> {
    try {
      return await this.carRentalService.createRentalCar(data);
    } catch (error) {
      this.logger.error('❌ Error creating rental car:', error);
      throw new HttpException(
        'Failed to create rental car',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * PUT /car-rental/:id
   * განაახლე მანქანის მონაცემები
   */
  @Put(':id')
  async updateRentalCar(
    @Param('id') id: string,
    @Body() data: Partial<CarRental>,
  ): Promise<CarRental> {
    try {
      return await this.carRentalService.updateRentalCar(id, data);
    } catch (error) {
      this.logger.error(`❌ Error updating rental car ${id}:`, error);
      throw new HttpException(
        error.message || 'Failed to update rental car',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * DELETE /car-rental/:id
   * წაშალე მანქანა
   */
  @Delete(':id')
  async deleteRentalCar(@Param('id') id: string): Promise<{ message: string }> {
    try {
      return await this.carRentalService.deleteRentalCar(id);
    } catch (error) {
      this.logger.error(`❌ Error deleting rental car ${id}:`, error);
      throw new HttpException(
        error.message || 'Failed to delete rental car',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * POST /car-rental/:id/book
   * დააჯავშნე მანქანა
   */
  @Post(':id/book')
  async bookRentalCar(
    @Param('id') id: string,
    @Body() body: { startDate: string; endDate: string },
  ): Promise<CarRental> {
    try {
      const { startDate, endDate } = body;

      if (!startDate || !endDate) {
        throw new HttpException(
          'Start date and end date are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      return await this.carRentalService.bookRentalCar(id, startDate, endDate);
    } catch (error) {
      this.logger.error(`❌ Error booking rental car ${id}:`, error);
      throw new HttpException(
        error.message || 'Failed to book rental car',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /car-rental/:id/cancel
   * გააუქმე დაჯავშნა
   */
  @Post(':id/cancel')
  async cancelBooking(
    @Param('id') id: string,
    @Body() body: { startDate: string; endDate: string },
  ): Promise<CarRental> {
    try {
      const { startDate, endDate } = body;

      if (!startDate || !endDate) {
        throw new HttpException(
          'Start date and end date are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      return await this.carRentalService.cancelBooking(id, startDate, endDate);
    } catch (error) {
      this.logger.error(`❌ Error cancelling booking for car ${id}:`, error);
      throw new HttpException(
        error.message || 'Failed to cancel booking',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /car-rental/:id/availability
   * შეამოწმე ხელმისაწვდომობა
   */
  @Get(':id/availability')
  async checkAvailability(
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ available: boolean; unavailableDates: string[] }> {
    try {
      if (!startDate || !endDate) {
        throw new HttpException(
          'Start date and end date are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      return await this.carRentalService.checkAvailability(
        id,
        startDate,
        endDate,
      );
    } catch (error) {
      this.logger.error(`❌ Error checking availability for car ${id}:`, error);
      throw new HttpException(
        error.message || 'Failed to check availability',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
