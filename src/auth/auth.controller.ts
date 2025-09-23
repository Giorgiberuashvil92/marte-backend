import { Body, Controller, Post, Put } from '@nestjs/common';
import { AuthService } from './auth.service';
import { StartAuthDto } from './dto/start-auth.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteAuthDto } from './dto/complete-auth.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateOwnedCarwashesDto } from './dto/update-owned-carwashes.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('start')
  start(@Body() dto: StartAuthDto) {
    console.log(
      `🚀 [AUTH_CONTROLLER] Start request received for phone: ${dto.phone}`,
    );
    return this.authService.start(dto.phone);
  }

  @Post('verify')
  verify(@Body() dto: VerifyOtpDto) {
    console.log(
      `🔐 [AUTH_CONTROLLER] Verify request received for OTP ID: ${dto.otpId}, Code: ${dto.code}`,
    );
    return this.authService.verify(dto.otpId, dto.code);
  }

  @Post('complete')
  complete(@Body() dto: CompleteAuthDto) {
    return this.authService.complete(dto.userId, {
      firstName: dto.firstName,
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
}
