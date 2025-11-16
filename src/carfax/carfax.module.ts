import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CarFAXController } from './carfax.controller';
import { CarFAXService } from './carfax.service';
import { CarFAXReport, CarFAXReportSchema } from '../schemas/carfax-report.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CarFAXReport.name, schema: CarFAXReportSchema },
    ]),
  ],
  controllers: [CarFAXController],
  providers: [CarFAXService],
  exports: [CarFAXService],
})
export class CarFAXModule {}
