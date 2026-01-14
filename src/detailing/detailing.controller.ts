import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  BadRequestException,
  NotFoundException,
  Request,
} from '@nestjs/common';
import { DetailingService } from './detailing.service';
import { CreateStoreDto } from '../stores/dto/create-store.dto';
import { UpdateStoreDto } from '../stores/dto/update-store.dto';
import { EngagementService } from '../engagement/engagement.service';

@Controller('detailing')
export class DetailingController {
  constructor(
    private readonly detailingService: DetailingService,
    private readonly engagementService: EngagementService,
  ) {}

  @Post()
  async create(@Body() createStoreDto: CreateStoreDto) {
    try {
      const data = await this.detailingService.create(createStoreDto);
      return {
        success: true,
        message: 'დითეილინგ მაღაზია წარმატებით დაემატა',
        data,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Get()
  async findAll(
    @Query('ownerId') ownerId?: string,
    @Query('location') location?: string,
    @Query('includeAll') includeAll?: string,
  ) {
    const stores = await this.detailingService.findAll(
      ownerId,
      location,
      includeAll === 'true',
    );
    return {
      success: true,
      message: 'დითეილინგ მაღაზიები წარმატებით ჩამოიტვირთა',
      data: stores,
      count: stores.length,
    };
  }

  @Get('locations')
  async getLocations() {
    const locations = await this.detailingService.getLocations();
    return {
      success: true,
      message: 'ქალაქები წარმატებით ჩამოიტვირთა',
      data: locations,
    };
  }

  // Engagement endpoints - must be before :id route
  @Get(':storeId/stats')
  async getStoreStats(@Param('storeId') storeId: string) {
    try {
      await this.detailingService.findOne(storeId);
      const stats = await this.engagementService.getStoreStats(storeId);
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Store not found',
      });
    }
  }

  @Get(':storeId/engagement')
  async getStoreEngagement(@Param('storeId') storeId: string) {
    try {
      await this.detailingService.findOne(storeId);
      const engagement =
        await this.engagementService.getStoreEngagement(storeId);
      return {
        success: true,
        data: engagement,
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Store not found',
      });
    }
  }

  @Post(':storeId/like')
  async likeStore(
    @Param('storeId') storeId: string,
    @Body() body: { userId: string },
    @Request() req: any,
  ) {
    try {
      await this.detailingService.findOne(storeId);
      const userId =
        body?.userId ||
        (req.headers['x-user-id'] as string) ||
        req.user?.id ||
        req.user?.uid;
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }
      await this.engagementService.trackStoreAction(storeId, userId, 'like');
      return {
        success: true,
        message: 'Store liked successfully',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Store not found',
      });
    }
  }

  @Post(':storeId/view')
  async viewStore(
    @Param('storeId') storeId: string,
    @Body() body: { userId: string },
    @Request() req: any,
  ) {
    try {
      await this.detailingService.findOne(storeId);
      const userId =
        body?.userId ||
        (req.headers['x-user-id'] as string) ||
        req.user?.id ||
        req.user?.uid;
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }
      await this.engagementService.trackStoreAction(
        storeId,
        userId,
        'view',
        true,
      );
      return {
        success: true,
        message: 'Store view tracked successfully',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Store not found',
      });
    }
  }

  @Post(':storeId/call')
  async callStore(
    @Param('storeId') storeId: string,
    @Body() body: { userId: string },
    @Request() req: any,
  ) {
    try {
      await this.detailingService.findOne(storeId);
      const userId =
        body?.userId ||
        (req.headers['x-user-id'] as string) ||
        req.user?.id ||
        req.user?.uid;
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }
      await this.engagementService.trackStoreAction(storeId, userId, 'call');
      return {
        success: true,
        message: 'Store call tracked successfully',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Store not found',
      });
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const data = await this.detailingService.findOne(id);
      return {
        success: true,
        message: 'დითეილინგ მაღაზიის დეტალები',
        data,
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateStoreDto: UpdateStoreDto,
  ) {
    try {
      const data = await this.detailingService.update(id, updateStoreDto);
      return {
        success: true,
        message: 'დითეილინგ მაღაზია წარმატებით განახლდა',
        data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('not found')) {
        throw new NotFoundException({
          success: false,
          message: errorMessage,
        });
      }
      throw new BadRequestException({
        success: false,
        message: errorMessage,
      });
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.detailingService.remove(id);
      return {
        success: true,
        message: 'დითეილინგ მაღაზია წარმატებით წაიშალა',
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
