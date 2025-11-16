import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ServicesService, ServiceItem } from './services.service';

@Controller('services')
export class ServicesController {
  private readonly logger = new Logger(ServicesController.name);

  constructor(private readonly servicesService: ServicesService) {}

  @Get('all')
  async getAllServices(
    @Query('sortBy') sortBy: 'date' | 'popularity' = 'date',
    @Query('order') order: 'asc' | 'desc' = 'desc',
    @Query('limit') limit?: string,
    @Query('type') type?: string, // carwash, store, dismantler, part, category
  ): Promise<ServiceItem[]> {
    this.logger.log(
      `getAllServices - sortBy: ${sortBy}, order: ${order}, type: ${type}`,
    );

    const limitNum = limit ? parseInt(limit, 10) : 50;

    return await this.servicesService.getAllServices({
      sortBy,
      order,
      limit: limitNum,
      type,
    });
  }

  @Get('recent')
  async getRecentServices(
    @Query('limit') limit?: string,
  ): Promise<ServiceItem[]> {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    this.logger.log(`getRecentServices - limit: ${limitNum}`);

    return await this.servicesService.getRecentServices(limitNum);
  }

  @Get('popular')
  async getPopularServices(
    @Query('limit') limit?: string,
  ): Promise<ServiceItem[]> {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    this.logger.log(`getPopularServices - limit: ${limitNum}`);

    return await this.servicesService.getPopularServices(limitNum);
  }
}
