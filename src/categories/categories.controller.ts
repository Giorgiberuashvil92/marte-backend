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
} from '@nestjs/common';
import { CategoriesService, CategoryStats } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  async create(@Body() categoryData: any) {
    try {
      const data = await this.categoriesService.create(categoryData);
      return {
        success: true,
        message: 'კატეგორია წარმატებით დაემატა',
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
  async findAll() {
    const data = await this.categoriesService.findAll();
    return {
      success: true,
      message: 'კატეგორიები წარმატებით ჩამოიტვირთა',
      data,
    };
  }

  @Get('popular')
  async findPopular(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 6;
    const data = await this.categoriesService.findPopular(limitNum);
    return {
      success: true,
      message: 'პოპულარული კატეგორიები',
      data,
    };
  }

  @Get('main')
  async getMainCategories() {
    const data = await this.categoriesService.getMainCategories();
    return {
      success: true,
      message: 'მთავარი კატეგორიები',
      data,
    };
  }

  @Get('search')
  async searchCategories(@Query('q') query: string) {
    if (!query) {
      throw new BadRequestException({
        success: false,
        message: 'საძიებო სიტყვა აუცილებელია',
      });
    }

    const data = await this.categoriesService.searchCategories(query);
    return {
      success: true,
      message: 'ძიების შედეგები',
      data,
    };
  }

  @Get('parent/:parentId')
  async getByParentId(@Param('parentId') parentId: string) {
    const data = await this.categoriesService.getByParentId(parentId);
    return {
      success: true,
      message: `${parentId} კატეგორიის ქვეკატეგორიები`,
      data,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const data = await this.categoriesService.findById(id);
      if (!data) {
        throw new NotFoundException('კატეგორია ვერ მოიძებნა');
      }
      return {
        success: true,
        message: 'კატეგორიის დეტალები',
        data,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Get(':id/stats')
  async getCategoryStats(
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string; data: CategoryStats }> {
    const data = this.categoriesService.getCategoryStats();
    return {
      success: true,
      message: 'კატეგორიის სტატისტიკა',
      data,
    };
  }

  @Post(':id/view')
  async incrementViewCount(@Param('id') id: string) {
    await this.categoriesService.incrementViewCount(id);
    return {
      success: true,
      message: 'ნახვის რაოდენობა გაიზარდა',
    };
  }

  @Post(':id/click')
  async incrementClickCount(@Param('id') id: string) {
    await this.categoriesService.incrementClickCount(id);
    return {
      success: true,
      message: 'დაწკაპუნების რაოდენობა გაიზარდა',
    };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updates: any) {
    try {
      const data = await this.categoriesService.update(id, updates);
      return {
        success: true,
        message: 'კატეგორია წარმატებით განახლდა',
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
  async remove(@Param('id') id: string) {
    try {
      await this.categoriesService.delete(id);
      return {
        success: true,
        message: 'კატეგორია წარმატებით წაიშალა',
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
