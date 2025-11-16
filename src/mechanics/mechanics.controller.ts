import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  BadRequestException,
  NotFoundException,
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
    if (
      !dto ||
      (!dto.name && !(dto.firstName && dto.lastName)) ||
      !dto.specialty
    ) {
      throw new BadRequestException(
        'name or (firstName & lastName) and specialty are required',
      );
    }
    return this.mechanicsService.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    // eslint-disable-next-line no-console
    console.log('[MECH_CTRL] GET /mechanics/:id', id);
    const mech = await this.mechanicsService.findById(id);
    if (!mech) throw new NotFoundException('mechanic not found');
    return mech;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    // eslint-disable-next-line no-console
    console.log('[MECH_CTRL] PATCH /mechanics/:id', id, dto);
    const updated = await this.mechanicsService.update(id, dto as any);
    if (!updated) throw new NotFoundException('mechanic not found');
    return updated;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    // eslint-disable-next-line no-console
    console.log('[MECH_CTRL] DELETE /mechanics/:id', id);
    return this.mechanicsService.delete(id);
  }
}
