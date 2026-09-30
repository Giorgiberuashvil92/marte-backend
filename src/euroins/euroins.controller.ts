import { Controller, Get, UseGuards } from '@nestjs/common';
import { PanelJwtGuard } from '../panel-admin/panel-jwt.guard';
import { EuroinsService } from './euroins.service';

@Controller('euroins')
export class EuroinsController {
  constructor(private readonly euroinsService: EuroinsService) {}

  /** Manual admin/debug trigger for the same reconciliation used by the cron. */
  @Get('subscriptions/reconcile')
  @UseGuards(PanelJwtGuard)
  async reconcile() {
    return { success: true, data: await this.euroinsService.reconcileSubscriptions() };
  }
}
