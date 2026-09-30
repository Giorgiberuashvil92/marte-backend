import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PartLeadsController } from './part-leads.controller';
import { PartLeadsService } from './part-leads.service';
import { PartLead, PartLeadSchema } from '../schemas/part-lead.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PartLead.name, schema: PartLeadSchema },
    ]),
  ],
  controllers: [PartLeadsController],
  providers: [PartLeadsService],
  exports: [PartLeadsService],
})
export class PartLeadsModule {}
