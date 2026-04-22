import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PanelAdminService } from './panel-admin.service';
import { PanelJwtGuard, type PanelJwtPayload } from './panel-jwt.guard';

@Controller('panel-admin')
export class PanelAdminController {
  constructor(private readonly panelAdmin: PanelAdminService) {}

  @Post('login')
  async login(@Body() body: { username?: string; password?: string }): Promise<{
    access_token: string;
    user: { username: string; displayName: string };
  }> {
    return this.panelAdmin.login(body.username ?? '', body.password ?? '');
  }

  @Get('session')
  @UseGuards(PanelJwtGuard)
  session(@Req() req: Request & { panelUser: PanelJwtPayload }) {
    return this.panelAdmin.sessionFromPayload(req.panelUser);
  }
}
