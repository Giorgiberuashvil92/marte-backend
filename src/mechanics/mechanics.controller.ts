import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { MechanicsService } from './mechanics.service';

@Controller('mechanics')
export class MechanicsController {
  constructor(private readonly mechanicsService: MechanicsService) {}

  @Get()
  findAll(
    @Query('q') q?: string,
    @Query('specialty') specialty?: string,
    @Query('location') location?: string,
  ) {
    // Debug log to verify routing
    // eslint-disable-next-line no-console
    console.log('[MECH_CTRL] GET /mechanics', { q, specialty, location });
    return this.mechanicsService.findAll({ q, specialty, location });
  }

  @Post()
  create(
    @Body()
    dto: {
      firstName?: string;
      lastName?: string;
      specialty?: string;
      location?: string;
      phone?: string;
      address?: string;
    } & Record<string, unknown>,
  ) {
    // eslint-disable-next-line no-console
    console.log('[MECH_CTRL] POST /mechanics body', dto);
    if (!dto || !dto.firstName || !dto.lastName || !dto.specialty) {
      throw new BadRequestException(
        'firstName, lastName and specialty are required',
      );
    }
    return this.mechanicsService.create(dto);
  }
}
