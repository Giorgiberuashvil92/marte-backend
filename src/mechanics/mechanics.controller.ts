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
  Request,
} from '@nestjs/common';
import { MechanicsService } from './mechanics.service';
import { EngagementService } from '../engagement/engagement.service';

@Controller('mechanics')
export class MechanicsController {
  constructor(
    private readonly mechanicsService: MechanicsService,
    private readonly engagementService: EngagementService,
  ) {}

  @Get()
  findAll(
    @Query('q') q?: string,
    @Query('specialty') specialty?: string,
    @Query('location') location?: string,
    @Query('ownerId') ownerId?: string,
    @Query('status') status?: string,
  ) {
    // Debug log to verify routing

    console.log('[MECH_CTRL] GET /mechanics', { q, specialty, location, ownerId, status });
    return this.mechanicsService.findAll({ q, specialty, location, ownerId, status });
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

  // Engagement endpoints - must be before :id route
  @Get(':mechanicId/stats')
  async getMechanicStats(@Param('mechanicId') mechanicId: string) {
    try {
      // Verify mechanic exists
      const mechanic = await this.mechanicsService.findById(mechanicId);
      if (!mechanic) {
        throw new NotFoundException('Mechanic not found');
      }
      const stats = await this.engagementService.getMechanicStats(mechanicId);
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Mechanic not found',
      });
    }
  }

  @Get(':mechanicId/engagement')
  async getMechanicEngagement(@Param('mechanicId') mechanicId: string) {
    try {
      // Verify mechanic exists
      const mechanic = await this.mechanicsService.findById(mechanicId);
      if (!mechanic) {
        throw new NotFoundException('Mechanic not found');
      }
      const engagement =
        await this.engagementService.getMechanicEngagement(mechanicId);
      return {
        success: true,
        data: engagement,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Mechanic not found',
      });
    }
  }

  @Post(':mechanicId/like')
  async likeMechanic(
    @Param('mechanicId') mechanicId: string,
    @Body() body: { userId: string },
    @Request() req: any,
  ) {
    try {
      // Verify mechanic exists
      const mechanic = await this.mechanicsService.findById(mechanicId);
      if (!mechanic) {
        throw new NotFoundException('Mechanic not found');
      }
      const userId =
        body?.userId ||
        (req.headers['x-user-id'] as string) ||
        req.user?.id ||
        req.user?.uid;
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }
      await this.engagementService.trackMechanicAction(
        mechanicId,
        userId,
        'like',
      );
      return {
        success: true,
        message: 'Mechanic liked successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Mechanic not found',
      });
    }
  }

  @Post(':mechanicId/view')
  async viewMechanic(
    @Param('mechanicId') mechanicId: string,
    @Body() body: { userId: string },
    @Request() req: any,
  ) {
    try {
      // Verify mechanic exists
      const mechanic = await this.mechanicsService.findById(mechanicId);
      if (!mechanic) {
        throw new NotFoundException('Mechanic not found');
      }
      const userId =
        body?.userId ||
        (req.headers['x-user-id'] as string) ||
        req.user?.id ||
        req.user?.uid;
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }
      await this.engagementService.trackMechanicAction(
        mechanicId,
        userId,
        'view',
        true, // Prevent duplicate views
      );
      return {
        success: true,
        message: 'Mechanic view tracked successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Mechanic not found',
      });
    }
  }

  @Post(':mechanicId/call')
  async callMechanic(
    @Param('mechanicId') mechanicId: string,
    @Body() body: { userId: string },
    @Request() req: any,
  ) {
    try {
      // Verify mechanic exists
      const mechanic = await this.mechanicsService.findById(mechanicId);
      if (!mechanic) {
        throw new NotFoundException('Mechanic not found');
      }
      const userId =
        body?.userId ||
        (req.headers['x-user-id'] as string) ||
        req.user?.id ||
        req.user?.uid;
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }
      await this.engagementService.trackMechanicAction(
        mechanicId,
        userId,
        'call',
      );
      return {
        success: true,
        message: 'Mechanic call tracked successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new NotFoundException({
        success: false,
        message: error instanceof Error ? error.message : 'Mechanic not found',
      });
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    console.log('[MECH_CTRL] GET /mechanics/:id', id);
    const mech = await this.mechanicsService.findById(id);
    if (!mech) throw new NotFoundException('mechanic not found');
    return mech;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    console.log('[MECH_CTRL] PATCH /mechanics/:id', id, dto);
    const updated = await this.mechanicsService.update(id, dto as any);
    if (!updated) throw new NotFoundException('mechanic not found');
    return updated;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    console.log('[MECH_CTRL] DELETE /mechanics/:id', id);
    return this.mechanicsService.delete(id);
  }

  @Patch(':id/renew')
  async renew(@Param('id') id: string) {
    try {
      const mechanic = await this.mechanicsService.renew(id);
      return {
        success: true,
        message: 'ხელოსნის განცხადება წარმატებით განახლდა',
        data: mechanic,
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'განახლება ვერ მოხერხდა',
      );
    }
  }

  @Patch(':id/upgrade-to-vip')
  async upgradeToVip(@Param('id') id: string) {
    try {
      const mechanic = await this.mechanicsService.updateToVip(id, true);
      return {
        success: true,
        message: 'ხელოსნის განცხადება წარმატებით გადაიყვანა VIP-ზე',
        data: mechanic,
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'VIP-ზე გადაყვანა ვერ მოხერხდა',
      );
    }
  }
}
