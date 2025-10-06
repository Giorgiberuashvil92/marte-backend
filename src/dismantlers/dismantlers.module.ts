import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DismantlersController } from './dismantlers.controller';
import { DismantlersService } from './dismantlers.service';
import { Dismantler, DismantlerSchema } from '../schemas/dismantler.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Dismantler.name, schema: DismantlerSchema },
    ]),
  ],
  controllers: [DismantlersController],
  providers: [DismantlersService],
  exports: [DismantlersService],
})
export class DismantlersModule {}
