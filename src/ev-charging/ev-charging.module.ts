import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EvChargingController } from './ev-charging.controller';
import { EvChargingService } from './ev-charging.service';
import { EvPartner, EvPartnerSchema } from '../schemas/ev-partner.schema';
import { EvStation, EvStationSchema } from '../schemas/ev-station.schema';
import {
  EvChargingSettings,
  EvChargingSettingsSchema,
} from '../schemas/ev-charging-settings.schema';
import {
  EvPromoRequest,
  EvPromoRequestSchema,
} from '../schemas/ev-promo-request.schema';
import { User, UserSchema } from '../schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EvPartner.name, schema: EvPartnerSchema },
      { name: EvStation.name, schema: EvStationSchema },
      { name: EvChargingSettings.name, schema: EvChargingSettingsSchema },
      { name: EvPromoRequest.name, schema: EvPromoRequestSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [EvChargingController],
  providers: [EvChargingService],
  exports: [EvChargingService],
})
export class EvChargingModule {}
