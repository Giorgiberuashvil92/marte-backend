import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeliveryLeadsController } from './delivery-leads.controller';
import { DeliveryLeadsService } from './delivery-leads.service';
import {
  DeliveryLead,
  DeliveryLeadSchema,
} from '../schemas/delivery-lead.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeliveryLead.name, schema: DeliveryLeadSchema },
    ]),
  ],
  controllers: [DeliveryLeadsController],
  providers: [DeliveryLeadsService],
  exports: [DeliveryLeadsService],
})
export class DeliveryLeadsModule {}
