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
import { PartsService } from './parts.service';
import { CreatePartDto } from './dto/create-part.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { EngagementService } from '../engagement/engagement.service';

@Controller('parts')
export class PartsController {
  constructor(
    private readonly partsService: PartsService,
    private readonly engagementService: EngagementService,
  ) {}

  @Post()
  async create(@Body() createPartDto: CreatePartDto) {
    try {
      const data = await this.partsService.create(createPartDto);
      return {
        success: true,
        message: 'ნაწილი წარმატებით დაემატა',
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
    @Query('category') category?: string,
    @Query('condition') condition?: string,
    @Query('brand') brand?: string,
    @Query('model') model?: string,
    @Query('location') location?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('status') status?: string,
  ) {
    const filters: {
      category?: string;
      condition?: string;
      brand?: string;
      model?: string;
      location?: string;
      status?: string;
      priceRange?: { min: number; max: number };
    } = {
      category,
      condition,
      brand,
      model,
      location,
      status,
    };

    if (minPrice || maxPrice) {
      filters.priceRange = {
        min: minPrice ? parseFloat(minPrice) : 0,
        max: maxPrice ? parseFloat(maxPrice) : Infinity,
      };
    }

    const parts = await this.partsService.findAll(filters);

    return {
      success: true,
      message: 'ნაწილები წარმატებით ჩამოიტვირთა',
      data: parts,
      count: parts.length,
    };
  }

  @Get('featured')
  async getFeatured() {
    const data = await this.partsService.getFeatured();
    return {
      success: true,
      message: 'რეკომენდებული ნაწილები',
      data,
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

    const data = await this.partsService.searchByKeyword(keyword);
    return {
      success: true,
      message: 'ძიების შედეგები',
      data,
    };
  }

  @Get('category/:category')
  async getByCategory(@Param('category') category: string) {
    const data = await this.partsService.getByCategory(category);
    return {
      success: true,
      message: `${category} კატეგორიის ნაწილები`,
      data,
    };
  }

  @Get('brand/:brand')
  async getByBrand(@Param('brand') brand: string) {
    const data = await this.partsService.getByBrand(brand);
    return {
      success: true,
      message: `${brand} ბრენდის ნაწილები`,
      data,
    };
  }

  @Get('locations')
  async getLocations() {
    const locations = await this.partsService.getLocations();
    return {
      success: true,
      message: 'ლოკაციები წარმატებით ჩამოიტვირთა',
      data: locations,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const data = await this.partsService.findOne(id);
      return {
        success: true,
        message: 'ნაწილის დეტალები',
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
  async update(@Param('id') id: string, @Body() updatePartDto: UpdatePartDto) {
    try {
      const data = await this.partsService.update(id, updatePartDto);
      return {
        success: true,
        message: 'ნაწილი წარმატებით განახლდა',
        data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('ვერ მოიძებნა')) {
        console.log('Error message:', errorMessage);
        throw new NotFoundException({
          success: false,
          message: errorMessage,
        });
      }
      console.log('Error message:', errorMessage);
      throw new BadRequestException({
        success: false,
        message: errorMessage,
      });
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.partsService.remove(id);
      return {
        success: true,
        message: 'ნაწილი წარმატებით წაიშალა',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.log('Error message:', errorMessage);
      throw new NotFoundException({
        success: false,
        message: errorMessage,
      });
    }
  }

  @Post(':partId/like')
  async toggleLike(
    @Param('partId') partId: string,
    @Body() body: { userId: string },
    @Request() req: any,
  ) {
    try {
      // Verify part exists
      await this.partsService.findOne(partId);
      const userId =
        body?.userId ||
        (req.headers['x-user-id'] as string) ||
        req.user?.id ||
        req.user?.uid;
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }
      const result = await this.engagementService.togglePartLike(
        partId,
        userId,
      );
      return {
        success: true,
        message: result.isLiked ? 'ნაწილი დაგულებულია' : 'დაგულება მოხსნილია',
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
        message: error instanceof Error ? error.message : 'Part not found',
      });
    }
  }

  @Get(':partId/stats')
  async getPartStats(@Param('partId') partId: string) {
    try {
      await this.partsService.findOne(partId);
      const stats = await this.engagementService.getPartStats(partId);
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Part not found',
      });
    }
  }

  @Get('likes/bulk')
  async getPartsLikes(
    @Query('partIds') partIds: string,
    @Query('userId') userId?: string,
  ) {
    try {
      const ids = partIds.split(',').filter((id) => id.trim());
      if (ids.length === 0) {
        throw new BadRequestException('Part IDs are required');
      }
      const likes = await this.engagementService.getPartsWithLikes(ids, userId);
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
}
