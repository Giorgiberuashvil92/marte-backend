import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DismantlersController } from './dismantlers.controller';
import { DismantlersService } from './dismantlers.service';
import { Dismantler, DismantlerSchema } from '../schemas/dismantler.schema';
import { EngagementModule } from '../engagement/engagement.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Dismantler.name, schema: DismantlerSchema },
    ]),
    EngagementModule,
  ],
  controllers: [DismantlersController],
  providers: [DismantlersService],
  exports: [DismantlersService],
})
export class DismantlersModule {}
