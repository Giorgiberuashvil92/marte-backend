import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MechanicsController } from './mechanics.controller';
import { MechanicsService } from './mechanics.service';
import { Mechanic, MechanicSchema } from '../schemas/mechanic.schema';
import { EngagementModule } from '../engagement/engagement.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Mechanic.name, schema: MechanicSchema },
    ]),
    EngagementModule,
  ],
  controllers: [MechanicsController],
  providers: [MechanicsService],
})
export class MechanicsModule {}
