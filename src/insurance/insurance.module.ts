import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InsuranceController } from './insurance.controller';
import { InsuranceService } from './insurance.service';
import {
  InsuranceLead,
  InsuranceLeadSchema,
} from '../schemas/insurance-lead.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InsuranceLead.name, schema: InsuranceLeadSchema },
    ]),
  ],
  controllers: [InsuranceController],
  providers: [InsuranceService],
  exports: [InsuranceService],
})
export class InsuranceModule {}
