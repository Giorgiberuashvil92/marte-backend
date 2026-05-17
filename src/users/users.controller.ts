import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Put,
  Patch,
  Delete,
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
    const lim = Math.max(1, Math.min(parseInt(limit || '20'), 1000));
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

  // Specific routes must come before generic :id route
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

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      idNumber?: string;
      role?: string;
      isActive?: boolean;
      profileImage?: string;
      preferences?: any;
      address?: string;
      city?: string;
      country?: string;
      zipCode?: string;
      dateOfBirth?: string;
      gender?: string;
    }>,
  ) {
    if (!id) throw new BadRequestException('id_required');
    if (!body || Object.keys(body).length === 0) {
      throw new BadRequestException('no_updates_provided');
    }
    const user = await this.users.update(id, body);
    return {
      success: true,
      message: 'მომხმარებელი წარმატებით განახლდა',
      data: user,
    };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id_required');
    await this.users.deleteUser(id);
    return {
      success: true,
      message: 'მომხმარებელი წარმატებით წაიშალა',
    };
  }

  @Get('phones')
  async getPhoneNumbers(
    @Query('role') role?: string,
    @Query('active') active?: string,
    @Query('loginAfter') loginAfter?: string,
  ) {
    const act = active === undefined ? undefined : active === 'true';
    const users = await this.users.getPhoneNumbers({
      role,
      active: act,
      loginAfter: loginAfter || undefined,
    });
    return {
      success: true,
      data: users,
      count: users.length,
    };
  }

  @Get(':id/profile')
  async profile(@Param('id') id: string, @Query('viewerId') viewerId?: string) {
    if (!id) throw new BadRequestException('id_required');
    const data = await this.users.getProfileById(id, viewerId);
    return { success: true, data };
  }

  @Get('profiles/by-username/:username')
  async profileByUsername(
    @Param('username') username: string,
    @Query('viewerId') viewerId?: string,
  ) {
    const data = await this.users.getProfileByUsername(username, viewerId);
    return { success: true, data };
  }

  @Patch(':id/profile')
  async updateProfile(
    @Param('id') id: string,
    @Body() body: { username?: string; bio?: string; avatar?: string },
  ) {
    if (!id) throw new BadRequestException('id_required');
    const data = await this.users.updateProfile(id, body || {});
    return { success: true, data };
  }

  @Post(':id/follow')
  async follow(@Param('id') id: string, @Body() body: { followerId?: string }) {
    if (!body?.followerId) throw new BadRequestException('follower_id_required');
    const data = await this.users.followUser(body.followerId, id);
    return { success: true, data };
  }

  @Delete(':id/follow')
  async unfollow(
    @Param('id') id: string,
    @Query('followerId') followerId?: string,
  ) {
    if (!followerId) throw new BadRequestException('follower_id_required');
    const data = await this.users.unfollowUser(followerId, id);
    return { success: true, data };
  }

  @Get(':id/followers')
  async followers(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const lim = Math.max(1, Math.min(parseInt(limit || '20'), 100));
    const off = Math.max(0, parseInt(offset || '0'));
    const data = await this.users.getFollowers(id, lim, off);
    return { success: true, data, count: data.length };
  }

  @Get(':id/following')
  async following(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const lim = Math.max(1, Math.min(parseInt(limit || '20'), 100));
    const off = Math.max(0, parseInt(offset || '0'));
    const data = await this.users.getFollowing(id, lim, off);
    return { success: true, data, count: data.length };
  }

  // Generic :id route must come last
  @Get(':id')
  async one(@Param('id') id: string) {
    if (!id) throw new BadRequestException('id_required');
    const user = await this.users.getById(id);
    return { success: true, data: user };
  }
}
