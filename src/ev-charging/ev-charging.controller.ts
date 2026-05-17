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
} from '@nestjs/common';
import { EvChargingService } from './ev-charging.service';

@Controller('ev-charging')
export class EvChargingController {
  constructor(private readonly evChargingService: EvChargingService) {}

  @Get('settings')
  async getSettings() {
    const data = await this.evChargingService.getSettings();
    return { success: true, data };
  }

  @Patch('settings')
  async patchSettings(@Body() body: Record<string, unknown>) {
    const data = await this.evChargingService.updateSettings(body as never);
    return { success: true, data };
  }

  /** მობილური აპი — აქტიური სადგურები რუკაზე */
  @Get('stations')
  async getStationsForApp(@Query('all') all?: string) {
    if (all === 'true') {
      const stations = await this.evChargingService.findAllStations(false);
      return { success: true, data: stations, count: stations.length };
    }
    const stations = await this.evChargingService.findActiveStationsForApp();
    return { success: true, data: stations, count: stations.length };
  }

  @Get('partners')
  async getPartners(@Query('activeOnly') activeOnly?: string) {
    const active = activeOnly !== 'false';
    const partners = await this.evChargingService.findAllPartners(active);
    return { success: true, data: partners, count: partners.length };
  }

  @Post('partners')
  async createPartner(@Body() body: Record<string, unknown>) {
    const created = await this.evChargingService.createPartner(body as never);
    return {
      success: true,
      message: 'პარტნიორი დაემატა',
      data: created,
    };
  }

  @Patch('partners/:id')
  async updatePartner(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const updated = await this.evChargingService.updatePartner(id, body as never);
    return { success: true, data: updated };
  }

  @Delete('partners/:id')
  async deletePartner(@Param('id') id: string) {
    await this.evChargingService.deletePartner(id);
    return { success: true, message: 'პარტნიორი წაიშალა' };
  }

  @Post('stations')
  async createStation(@Body() body: Record<string, unknown>) {
    if (!body.siteName || !body.address) {
      throw new BadRequestException('siteName და address სავალდებულოა');
    }
    const created = await this.evChargingService.createStation(body as never);
    return {
      success: true,
      message: 'სადგური დაემატა',
      data: created,
    };
  }

  @Patch('stations/:id')
  async updateStation(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const updated = await this.evChargingService.updateStation(id, body);
    return { success: true, data: updated };
  }

  @Delete('stations/:id')
  async deleteStation(@Param('id') id: string) {
    await this.evChargingService.deleteStation(id);
    return { success: true, message: 'სადგური წაიშალა' };
  }

  @Post('seed')
  async seed(@Query('force') force?: string) {
    const result = await this.evChargingService.seedDemo(force === 'true');
    return { success: true, ...result };
  }
}
