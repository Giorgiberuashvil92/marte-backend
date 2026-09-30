import { UserSessionGuard, UserSessionService } from './user-session';
import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { StartAuthDto } from './dto/start-auth.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteAuthDto } from './dto/complete-auth.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateOwnedCarwashesDto } from './dto/update-owned-carwashes.dto';
import { UpdateOwnedStoresDto } from './dto/update-owned-stores.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly sessions: UserSessionService) {}

  @Post('start')
  start(@Body() dto: StartAuthDto) {
    console.log(
      `🚀 [AUTH_CONTROLLER] Start request received for phone: ${dto.phone}`,
    );
    return this.authService.start(dto.phone);
  }

  @Post('verify')
  async verify(@Body() dto: VerifyOtpDto) {
    return this.authService.verify(dto.otpId, dto.code, dto.referralCode);
  }

  @Post('logout')
  @UseGuards(UserSessionGuard)
  async logout(@Req() req: any) {
    const auth = String(req.headers.authorization || '');
    const bearer = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim();
    if (bearer) await this.sessions.revoke(bearer);
    return { success: true };
  }

  @Post('complete')
  complete(@Body() dto: CompleteAuthDto) {
    return this.authService.complete(dto.userId, {
      firstName: dto.firstName,
      personalId: dto.personalId,
      role: dto.role,
    });
  }

  @Put('update-role')
  async updateRole(@Body() dto: UpdateRoleDto) {
    return await this.authService.updateRole(dto.userId, dto.role);
  }

  @Put('update-owned-carwashes')
  async updateOwnedCarwashes(@Body() dto: UpdateOwnedCarwashesDto) {
    return await this.authService.updateOwnedCarwashes(
      dto.userId,
      dto.carwashId,
      dto.action,
    );
  }

  @Put('update-owned-stores')
  async updateOwnedStores(@Body() dto: UpdateOwnedStoresDto) {
    console.log(
      `🔍 [AUTH_CONTROLLER] updateOwnedStores called with userId: ${dto.userId}, storeId: ${dto.storeId}, action: ${dto.action}`,
    );
    return await this.authService.updateOwnedStores(
      dto.userId,
      dto.storeId,
      dto.action,
    );
  }

  @Get('verify-user/:userId')
  async verifyUser(@Param('userId') userId: string) {
    return await this.authService.verifyUser(userId);
  }
}
