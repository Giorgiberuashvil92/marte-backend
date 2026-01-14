import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SpecialOffersService } from './special-offers.service';

@Controller('special-offers')
export class SpecialOffersController {
  constructor(private readonly specialOffersService: SpecialOffersService) {}

  @Post()
  async create(@Body() body: any) {
    try {
      if (!body.storeId || !body.discount || !body.oldPrice || !body.newPrice) {
        throw new BadRequestException(
          'storeId, discount, oldPrice, and newPrice are required',
        );
      }
      const created = await this.specialOffersService.create(body);
      return {
        success: true,
        message: 'სპეციალური შეთავაზება წარმატებით დაემატა',
        data: created,
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

  @Get()
  async findAll(@Query('activeOnly') activeOnly?: string) {
    const active = activeOnly !== 'false';
    const offers = await this.specialOffersService.findAll(active);
    return {
      success: true,
      data: offers,
      count: offers.length,
    };
  }

  @Get('store/:storeId')
  async findByStoreId(
    @Param('storeId') storeId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const active = activeOnly !== 'false';
    const offers = await this.specialOffersService.findByStoreId(storeId, active);
    return {
      success: true,
      data: offers,
      count: offers.length,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const offer = await this.specialOffersService.findOne(id);
      return {
        success: true,
        data: offer,
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    try {
      const updated = await this.specialOffersService.update(id, body);
      return {
        success: true,
        message: 'სპეციალური შეთავაზება წარმატებით განახლდა',
        data: updated,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Patch(':id/toggle-active')
  async toggleActive(@Param('id') id: string) {
    try {
      const updated = await this.specialOffersService.toggleActive(id);
      return {
        success: true,
        message: `სპეციალური შეთავაზება ${updated.isActive ? 'აქტივირებულია' : 'დეაქტივირებულია'}`,
        data: updated,
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    try {
      await this.specialOffersService.delete(id);
      return {
        success: true,
        message: 'სპეციალური შეთავაზება წარმატებით წაიშალა',
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

