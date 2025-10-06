import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PartsService } from './parts.service';
import { PartsController } from './parts.controller';
import { Part, PartSchema } from '../schemas/part.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Part.name, schema: PartSchema }]),
  ],
  controllers: [PartsController],
  providers: [PartsService],
})
export class PartsModule {}
