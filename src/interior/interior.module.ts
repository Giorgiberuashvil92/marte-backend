import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Store, StoreSchema } from '../schemas/store.schema';
import { InteriorController } from './interior.controller';
import { InteriorService } from './interior.service';
import { EngagementModule } from '../engagement/engagement.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Store.name, schema: StoreSchema }]),
    EngagementModule,
  ],
  controllers: [InteriorController],
  providers: [InteriorService],
  exports: [InteriorService],
})
export class InteriorModule {}

