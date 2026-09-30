import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DriverAlert, DriverAlertSchema } from '../schemas/driver-alert.schema';
import { DriverAlertsController } from './driver-alerts.controller';
import { DriverAlertsService } from './driver-alerts.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: DriverAlert.name, schema: DriverAlertSchema }])],
  controllers: [DriverAlertsController],
  providers: [DriverAlertsService],
  exports: [DriverAlertsService],
})
export class DriverAlertsModule {}
