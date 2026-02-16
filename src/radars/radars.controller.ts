import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RadarsService } from './radars.service';
import { Radar } from '../schemas/radar.schema';

@Controller('radars')
export class RadarsController {
  constructor(private readonly radarsService: RadarsService) {}

  /**
   * ყველა რადარის მიღება
   */
  @Get()
  async getAllRadars(): Promise<{ success: boolean; data: Radar[] }> {
    const radars = await this.radarsService.getAllRadars();
    return { success: true, data: radars };
  }

  /**
   * რადარების მიღება რეგიონის მიხედვით
   */
  @Get('region')
  async getRadarsByRegion(
    @Query('minLat') minLat: string,
    @Query('maxLat') maxLat: string,
    @Query('minLng') minLng: string,
    @Query('maxLng') maxLng: string,
  ): Promise<{ success: boolean; data: Radar[] }> {
    const radars = await this.radarsService.getRadarsByRegion(
      parseFloat(minLat),
      parseFloat(maxLat),
      parseFloat(minLng),
      parseFloat(maxLng),
    );
    return { success: true, data: radars };
  }

  /**
   * რადარების მიღება მანძილის მიხედვით
   */
  @Get('nearby')
  async getRadarsNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ): Promise<{ success: boolean; data: Radar[] }> {
    const radars = await this.radarsService.getRadarsNearby(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseFloat(radius) : 5,
    );
    return { success: true, data: radars };
  }

  /**
   * რადარის შექმნა
   */
  @Post()
  async createRadar(
    @Body() radarData: Partial<Radar>,
  ): Promise<{ success: boolean; data: Radar }> {
    const radar = await this.radarsService.createRadar(radarData);
    return { success: true, data: radar };
  }

  /**
   * რადარის განახლება
   */
  @Put(':id')
  async updateRadar(
    @Param('id') id: string,
    @Body() radarData: Partial<Radar>,
  ): Promise<{ success: boolean; data: Radar }> {
    const radar = await this.radarsService.updateRadar(id, radarData);
    return { success: true, data: radar };
  }

  /**
   * ჯარიმის დამატება რადარზე
   */
  @Post(':id/fine')
  async addFine(
    @Param('id') id: string,
  ): Promise<{ success: boolean; data: Radar }> {
    const radar = await this.radarsService.addFine(id);
    return { success: true, data: radar };
  }

  /**
   * რადარების სინქრონიზაცია
   */
  @Post('sync')
  async syncRadars(): Promise<{ success: boolean; message: string }> {
    await this.radarsService.syncFromRadarsGe();
    return { success: true, message: 'რადარების სინქრონიზაცია დასრულდა' };
  }
}
