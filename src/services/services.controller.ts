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
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ServicesService, ServiceItem } from './services.service';
import { AutoServicesService } from './auto-services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Controller('services')
export class ServicesController {
  private readonly logger = new Logger(ServicesController.name);

  constructor(
    private readonly servicesService: ServicesService,
    private readonly autoServicesService: AutoServicesService,
  ) {}

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

  // Services CRUD endpoints
  @Post('create')
  async createService(@Body() createServiceDto: CreateServiceDto) {
    try {
      const data = await this.autoServicesService.create(createServiceDto);
      return {
        success: true,
        message: 'სერვისი წარმატებით დაემატა',
        data,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Get('list')
  async findAllServices(
    @Query('category') category?: string,
    @Query('location') location?: string,
    @Query('isOpen') isOpen?: string,
    @Query('status') status?: string,
  ) {
    const filters: {
      category?: string;
      location?: string;
      isOpen?: boolean;
      status?: string;
    } = {};

    if (category) filters.category = category;
    if (location) filters.location = location;
    if (isOpen) filters.isOpen = isOpen === 'true';
    if (status) filters.status = status;

    const services = await this.autoServicesService.findAll(filters);

    return {
      success: true,
      message: 'სერვისები წარმატებით ჩამოიტვირთა',
      data: services,
      count: services.length,
    };
  }

  @Get('search')
  async searchServices(@Query('q') keyword: string) {
    if (!keyword) {
      throw new BadRequestException({
        success: false,
        message: 'საძიებო სიტყვა აუცილებელია',
      });
    }

    const services = await this.autoServicesService.search(keyword);
    return {
      success: true,
      message: 'ძიების შედეგები',
      data: services,
      count: services.length,
    };
  }

  @Get('owner/:ownerId')
  async findByOwner(@Param('ownerId') ownerId: string) {
    const services = await this.autoServicesService.findByOwner(ownerId);
    return {
      success: true,
      message: 'სერვისები წარმატებით ჩამოიტვირთა',
      data: services,
      count: services.length,
    };
  }

  @Get(':id')
  async findOneService(@Param('id') id: string) {
    try {
      const service = await this.autoServicesService.findOne(id);
      return {
        success: true,
        message: 'სერვისი წარმატებით ჩამოიტვირთა',
        data: service,
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'სერვისი ვერ მოიძებნა',
      });
    }
  }

  @Patch(':id')
  async updateService(
    @Param('id') id: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    try {
      const data = await this.autoServicesService.update(id, updateServiceDto);
      return {
        success: true,
        message: 'სერვისი წარმატებით განახლდა',
        data,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Delete(':id')
  async removeService(@Param('id') id: string) {
    try {
      const data = await this.autoServicesService.remove(id);
      return {
        success: true,
        message: 'სერვისი წარმატებით წაიშალა',
        data,
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'სერვისი ვერ მოიძებნა',
      });
    }
  }
}
