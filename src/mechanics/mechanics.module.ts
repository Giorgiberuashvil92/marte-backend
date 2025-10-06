import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MechanicsController } from './mechanics.controller';
import { MechanicsService } from './mechanics.service';
import { Mechanic, MechanicSchema } from '../schemas/mechanic.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Mechanic.name, schema: MechanicSchema },
    ]),
  ],
  controllers: [MechanicsController],
  providers: [MechanicsService],
})
export class MechanicsModule {}
