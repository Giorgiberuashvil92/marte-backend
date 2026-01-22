import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EngagementService } from './engagement.service';
import {
  StoreEngagement,
  StoreEngagementSchema,
} from '../schemas/store-engagement.schema';
import {
  MechanicEngagement,
  MechanicEngagementSchema,
} from '../schemas/mechanic-engagement.schema';
import {
  DismantlerEngagement,
  DismantlerEngagementSchema,
} from '../schemas/dismantler-engagement.schema';
import {
  PartEngagement,
  PartEngagementSchema,
} from '../schemas/part-engagement.schema';
import { User, UserSchema } from '../schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StoreEngagement.name, schema: StoreEngagementSchema },
      { name: MechanicEngagement.name, schema: MechanicEngagementSchema },
      { name: DismantlerEngagement.name, schema: DismantlerEngagementSchema },
      { name: PartEngagement.name, schema: PartEngagementSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [EngagementService],
  exports: [EngagementService],
})
export class EngagementModule {}
