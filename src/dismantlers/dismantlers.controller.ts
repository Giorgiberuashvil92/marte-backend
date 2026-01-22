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
import { CreateDismantlerDto } from './dto/create-dismantler.dto';
import { UpdateDismantlerDto } from './dto/update-dismantler.dto';
import { DismantlersService } from './dismantlers.service';
import { EngagementService } from '../engagement/engagement.service';

@Controller('dismantlers')
export class DismantlersController {
  constructor(
    private readonly dismantlersService: DismantlersService,
    private readonly engagementService: EngagementService,
  ) {}

  @Post()
  async create(
    @Request() req: any,
    @Body() createDismantlerDto: CreateDismantlerDto,
  ) {
    console.log('🚀 DismantlersController.create called');

    // Get userId from headers (sent by frontend)
    const userId = req.headers['x-user-id'] || 'demo-user';
    console.log('👤 User ID from headers:', userId);

    console.log(
      '📝 Request body:',
      JSON.stringify(createDismantlerDto, null, 2),
    );

    try {
      console.log('✅ Validation passed, calling service...');
      const data = await this.dismantlersService.create({
        ...createDismantlerDto,
        ownerId: userId,
      });
      console.log('✅ Service returned:', JSON.stringify(data, null, 2));

      return {
        success: true,
        message: 'დაშლილების განცხადება წარმატებით შეიქმნა',
        data,
      };
    } catch (error) {
      console.error('❌ Error in create:', error);
      console.error('❌ Error message:', error?.message);
      console.error('❌ Error stack:', error?.stack);

      throw new BadRequestException({
        success: false,
        message: error.message as string,
      });
    }
  }

  @Get()
  async findAll(
    @Query('brand') brand?: string,
    @Query('model') model?: string,
    @Query('yearFrom') yearFrom?: string,
    @Query('yearTo') yearTo?: string,
    @Query('location') location?: string,
    @Query('status') status?: string,
    @Query('ownerId') ownerId?: string,
  ) {
    const filters = {
      brand,
      model,
      yearFrom: yearFrom ? parseInt(yearFrom) : undefined,
      yearTo: yearTo ? parseInt(yearTo) : undefined,
      location,
      status,
      ownerId,
    };

    const dismantlers = await this.dismantlersService.findAll(filters);

    return {
      success: true,
      message: 'დაშლილების განცხადებები წარმატებით ჩამოიტვირთა',
      data: dismantlers,
      count: dismantlers.length,
    };
  }

  @Get('featured')
  async getFeatured() {
    const featured = await this.dismantlersService.getFeatured();
    return {
      success: true,
      message: 'რეკომენდებული დაშლილები',
      data: featured,
    };
  }

  @Get('search')
  async search(@Query('q') keyword: string) {
    if (!keyword) {
      throw new BadRequestException({
        success: false,
        message: 'საძიებო სიტყვა აუცილებელია',
      });
    }

    const results = await this.dismantlersService.searchByKeyword(keyword);
    return {
      success: true,
      message: 'ძიების შედეგები',
      data: results,
    };
  }

  @Get('brand/:brand')
  async getByBrand(@Param('brand') brand: string) {
    const results = await this.dismantlersService.getByBrand(brand);
    return {
      success: true,
      message: `${brand} ბრენდის დაშლილები`,
      data: results,
    };
  }

  // Engagement endpoints - must be before :id route
  @Get(':dismantlerId/stats')
  async getDismantlerStats(@Param('dismantlerId') dismantlerId: string) {
    try {
      // Verify dismantler exists
      await this.dismantlersService.findOne(dismantlerId);
      const stats =
        await this.engagementService.getDismantlerStats(dismantlerId);
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message:
          error instanceof Error ? error.message : 'Dismantler not found',
      });
    }
  }

  @Get('likes/bulk')
  async getDismantlersLikes(
    @Query('dismantlerIds') dismantlerIds: string,
    @Query('userId') userId?: string,
  ) {
    try {
      const ids = dismantlerIds.split(',').filter((id) => id.trim());
      if (ids.length === 0) {
        throw new BadRequestException('Dismantler IDs are required');
      }
      const likes = await this.engagementService.getDismantlersWithLikes(
        ids,
        userId,
      );
      return {
        success: true,
        data: likes,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Get(':dismantlerId/engagement')
  async getDismantlerEngagement(@Param('dismantlerId') dismantlerId: string) {
    try {
      // Verify dismantler exists
      await this.dismantlersService.findOne(dismantlerId);
      const engagement =
        await this.engagementService.getDismantlerEngagement(dismantlerId);
      return {
        success: true,
        data: engagement,
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message:
          error instanceof Error ? error.message : 'Dismantler not found',
      });
    }
  }

  @Post(':dismantlerId/like')
  async toggleLike(
    @Param('dismantlerId') dismantlerId: string,
    @Body() body: { userId: string },
    @Request() req: any,
  ) {
    try {
      // Verify dismantler exists
      await this.dismantlersService.findOne(dismantlerId);
      const userId =
        body?.userId ||
        (req.headers['x-user-id'] as string) ||
        req.user?.id ||
        req.user?.uid;
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }
      const result = await this.engagementService.toggleDismantlerLike(
        dismantlerId,
        userId,
      );
      return {
        success: true,
        message: result.isLiked
          ? 'დაშლილები დაგულებულია'
          : 'დაგულება მოხსნილია',
        data: result,
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
        message:
          error instanceof Error ? error.message : 'Dismantler not found',
      });
    }
  }

  @Post(':dismantlerId/view')
  async viewDismantler(
    @Param('dismantlerId') dismantlerId: string,
    @Body() body: { userId: string },
    @Request() req: any,
  ) {
    try {
      // Verify dismantler exists
      await this.dismantlersService.findOne(dismantlerId);
      const userId =
        body?.userId ||
        (req.headers['x-user-id'] as string) ||
        req.user?.id ||
        req.user?.uid;
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }
      await this.engagementService.trackDismantlerAction(
        dismantlerId,
        userId,
        'view',
        true,
      );
      return {
        success: true,
        message: 'Dismantler view tracked successfully',
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
        message:
          error instanceof Error ? error.message : 'Dismantler not found',
      });
    }
  }

  @Post(':dismantlerId/call')
  async callDismantler(
    @Param('dismantlerId') dismantlerId: string,
    @Body() body: { userId: string },
    @Request() req: any,
  ) {
    try {
      // Verify dismantler exists
      await this.dismantlersService.findOne(dismantlerId);
      const userId =
        body?.userId ||
        (req.headers['x-user-id'] as string) ||
        req.user?.id ||
        req.user?.uid;
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }
      await this.engagementService.trackDismantlerAction(
        dismantlerId,
        userId,
        'call',
      );
      return {
        success: true,
        message: 'Dismantler call tracked successfully',
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
        message:
          error instanceof Error ? error.message : 'Dismantler not found',
      });
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const result = await this.dismantlersService.findOne(id);
      return {
        success: true,
        message: 'დაშლილების განცხადება',
        data: result,
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: error.message as string,
      });
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDismantlerDto: UpdateDismantlerDto,
  ) {
    try {
      const result = await this.dismantlersService.update(
        id,
        updateDismantlerDto,
      );
      return {
        success: true,
        message: 'დაშლილების განცხადება წარმატებით განახლდა',
        data: result,
      };
    } catch (error) {
      if (error.message?.includes('ვერ მოიძებნა')) {
        throw new NotFoundException({
          success: false,
          message: error.message as string,
        });
      }
      throw new BadRequestException({
        success: false,
        message: error.message as string,
      });
    }
  }

  @Patch(':id/renew')
  async renew(@Param('id') id: string) {
    try {
      const result = await this.dismantlersService.renew(id);
      return {
        success: true,
        message: 'დაშლილების განცხადება წარმატებით განახლდა',
        data: result,
      };
    } catch (error) {
      if (error.message?.includes('ვერ მოიძებნა')) {
        throw new NotFoundException({
          success: false,
          message: error.message as string,
        });
      }
      throw new BadRequestException({
        success: false,
        message: error.message as string,
      });
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.dismantlersService.remove(id);
      return {
        success: true,
        message: 'დაშლილების განცხადება წარმატებით წაიშალა',
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: error.message as string,
      });
    }
  }
}
