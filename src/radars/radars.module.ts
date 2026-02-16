import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RadarsController } from './radars.controller';
import { RadarsService } from './radars.service';
import { Radar, RadarSchema } from '../schemas/radar.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Radar.name, schema: RadarSchema }]),
  ],
  controllers: [RadarsController],
  providers: [RadarsService],
  exports: [RadarsService],
})
export class RadarsModule {}
