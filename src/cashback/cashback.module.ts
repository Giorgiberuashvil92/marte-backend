import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSessionModule } from '../auth/user-session';
import { PanelAdminModule } from '../panel-admin/panel-admin.module';
import { CashbackInvoice, CashbackInvoiceSchema } from './cashback.schema';
import { CashbackService } from './cashback.service';
import { CashbackController, CashbackAdminController } from './cashback.controller';
@Module({
  imports: [UserSessionModule, PanelAdminModule, MongooseModule.forFeature([{ name: CashbackInvoice.name, schema: CashbackInvoiceSchema }])],
  controllers: [CashbackController, CashbackAdminController], providers: [CashbackService],
})
export class CashbackModule {}
