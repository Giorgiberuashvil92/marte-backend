import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Store, StoreSchema } from '../schemas/store.schema';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { EngagementModule } from '../engagement/engagement.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Store.name, schema: StoreSchema }]),
    EngagementModule,
  ],
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}
