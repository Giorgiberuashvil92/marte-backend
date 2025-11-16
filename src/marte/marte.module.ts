import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarteController } from './marte.controller';
import { MarteService } from './marte.service';
import { MarteOrder, MarteOrderSchema } from '../schemas/marte-order.schema';
import {
  MarteAssistant,
  MarteAssistantSchema,
} from '../schemas/marte-assistant.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarteOrder.name, schema: MarteOrderSchema },
      { name: MarteAssistant.name, schema: MarteAssistantSchema },
    ]),
  ],
  controllers: [MarteController],
  providers: [MarteService],
  exports: [MarteService],
})
export class MarteModule {}
