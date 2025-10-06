import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AIRecommendationsService } from './ai-recommendations.service';
import { AIController } from './ai.controller';
import { Store, StoreSchema } from '../schemas/store.schema';
import { Dismantler, DismantlerSchema } from '../schemas/dismantler.schema';
import { Part, PartSchema } from '../schemas/part.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Store.name, schema: StoreSchema },
      { name: Dismantler.name, schema: DismantlerSchema },
      { name: Part.name, schema: PartSchema },
    ]),
  ],
  controllers: [AIController],
  providers: [AIRecommendationsService],
  exports: [AIRecommendationsService],
})
export class AIModule {}
