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
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  async create(@Body() createStoreDto: CreateStoreDto) {
    try {
      const data = await this.storesService.create(createStoreDto);
      return {
        success: true,
        message: 'მაღაზია წარმატებით დაემატა',
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
  ) {
    const stores = await this.storesService.findAll(ownerId, location);
    return {
      success: true,
      message: 'მაღაზიები წარმატებით ჩამოიტვირთა',
      data: stores,
      count: stores.length,
    };
  }

  @Get('locations')
  async getLocations() {
    const locations = await this.storesService.getLocations();
    return {
      success: true,
      message: 'ქალაქები წარმატებით ჩამოიტვირთა',
      data: locations,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const data = await this.storesService.findOne(id);
      return {
        success: true,
        message: 'მაღაზიის დეტალები',
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
      const data = await this.storesService.update(id, updateStoreDto);
      return {
        success: true,
        message: 'მაღაზია წარმატებით განახლდა',
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
      await this.storesService.remove(id);
      return {
        success: true,
        message: 'მაღაზია წარმატებით წაიშალა',
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
