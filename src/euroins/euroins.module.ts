import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../schemas/user.schema';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PanelAdminModule } from '../panel-admin/panel-admin.module';
import { EuroinsService } from './euroins.service';
import { EuroinsController } from './euroins.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    SubscriptionsModule,
    PanelAdminModule,
  ],
  controllers: [EuroinsController],
  providers: [EuroinsService],
  exports: [EuroinsService],
})
export class EuroinsModule {}
