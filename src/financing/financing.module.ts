import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FinancingService } from './financing.service';
import { FinancingController } from './financing.controller';
import { FinancingRequest, FinancingRequestSchema } from './financing.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FinancingRequest.name, schema: FinancingRequestSchema },
    ]),
  ],
  controllers: [FinancingController],
  providers: [FinancingService],
})
export class FinancingModule {}
