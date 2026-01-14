import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Store, StoreSchema } from '../schemas/store.schema';
import { DetailingController } from './detailing.controller';
import { DetailingService } from './detailing.service';
import { EngagementModule } from '../engagement/engagement.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Store.name, schema: StoreSchema }]),
    EngagementModule,
  ],
  controllers: [DetailingController],
  providers: [DetailingService],
  exports: [DetailingService],
})
export class DetailingModule {}
