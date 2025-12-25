import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { LoginHistoryService } from './login-history.service';
import { TrackLoginDto } from './dto/track-login.dto';

@Controller('login-history')
export class LoginHistoryController {
  constructor(
    private readonly loginHistoryService: LoginHistoryService,
  ) {}

  @Get()
  async getAll(
    @Query('userId') userId?: string,
    @Query('phone') phone?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: 'success' | 'failed',
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const filters: any = {};
    if (userId) filters.userId = userId;
    if (phone) filters.phone = phone;
    if (status) filters.status = status;
    if (startDate) {
      filters.startDate = new Date(startDate);
    }
    if (endDate) {
      filters.endDate = new Date(endDate);
    }

    const limitNum = limit ? parseInt(limit, 10) : 100;
    const skipNum = skip ? parseInt(skip, 10) : 0;

    const result = await this.loginHistoryService.getAllLoginHistory(
      filters,
      limitNum,
      skipNum,
    );

    return {
      success: true,
      message: 'Login history წარმატებით ჩამოიტვირთა',
      data: result.data,
      total: result.total,
      limit: limitNum,
      skip: skipNum,
    };
  }

  @Get('user/:userId')
  async getUserHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID აუცილებელია');
    }

    const limitNum = limit ? parseInt(limit, 10) : 50;
    const history = await this.loginHistoryService.getUserLoginHistory(
      userId,
      limitNum,
    );

    return {
      success: true,
      message: 'User login history წარმატებით ჩამოიტვირთა',
      data: history,
      count: history.length,
    };
  }

  @Get('stats')
  async getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const stats = await this.loginHistoryService.getLoginStats(start, end);

    return {
      success: true,
      message: 'Login statistics წარმატებით ჩამოიტვირთა',
      data: stats,
    };
  }

  @Post('track')
  async trackLogin(@Body() body: TrackLoginDto) {
    if (!body.userId || !body.phone) {
      throw new BadRequestException('User ID და Phone აუცილებელია');
    }

    const loginHistory = await this.loginHistoryService.createLoginHistory({
      userId: body.userId,
      phone: body.phone,
      email: body.email,
      firstName: body.firstName,
      deviceInfo: body.deviceInfo,
      ipAddress: body.ipAddress,
      userAgent: body.userAgent,
      status: 'success',
    });

    return {
      success: true,
      message: 'Login history წარმატებით შენახულია',
      data: loginHistory,
    };
  }
}

