import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CarFAXController } from './carfax.controller';
import { CarFAXService } from './carfax.service';
import {
  CarFAXReport,
  CarFAXReportSchema,
} from '../schemas/carfax-report.schema';
import { CarFAXUsage, CarFAXUsageSchema } from '../schemas/carfax-usage.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CarFAXReport.name, schema: CarFAXReportSchema },
      { name: CarFAXUsage.name, schema: CarFAXUsageSchema },
    ]),
  ],
  controllers: [CarFAXController],
  providers: [CarFAXService],
  exports: [CarFAXService],
})
export class CarFAXModule {}
