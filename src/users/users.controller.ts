import {
  Controller,
  Get,
  Query,
  Param,
  Put,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('role') role?: string,
    @Query('active') active?: string,
  ) {
    const lim = Math.max(1, Math.min(parseInt(limit || '20'), 100));
    const off = Math.max(0, parseInt(offset || '0'));
    const act = active === undefined ? undefined : active === 'true';
    const data = await this.users.list({
      q,
      limit: lim,
      offset: off,
      role,
      active: act,
    });
    return { success: true, ...data };
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id_required');
    const user = await this.users.getById(id);
    return { success: true, data: user };
  }

  @Put(':id/role')
  async updateRole(@Param('id') id: string, @Body() body: { role?: string }) {
    if (!id || !body?.role) throw new BadRequestException('invalid_payload');
    const user = await this.users.updateRole(id, body.role);
    return { success: true, data: user };
  }

  @Put(':id/active')
  async updateActive(
    @Param('id') id: string,
    @Body() body: { isActive?: boolean },
  ) {
    if (!id || typeof body?.isActive !== 'boolean')
      throw new BadRequestException('invalid_payload');
    const user = await this.users.updateActive(id, body.isActive);
    return { success: true, data: user };
  }
}
