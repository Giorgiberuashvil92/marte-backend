import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { DriverAlertsService } from './driver-alerts.service';

@Controller('driver-alerts')
export class DriverAlertsController {
  constructor(private readonly service: DriverAlertsService) {}

  @Get()
  async list(@Query('limit') limit?: string) {
    return { success: true, data: await this.service.list(Number(limit || 20)) };
  }

  @Post()
  async create(@Body() body: Partial<{ userId: string; title: string; description: string; type: string; location: string; latitude: number; longitude: number; expiresAt: string }>) {
    return { success: true, data: await this.service.create(body as Partial<any>) };
  }
}
