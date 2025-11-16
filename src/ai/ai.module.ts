import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AIRecommendationsService } from './ai-recommendations.service';
import { AINotificationsService } from './ai-notifications.service';
import { AIController } from './ai.controller';
import { Store, StoreSchema } from '../schemas/store.schema';
import { Dismantler, DismantlerSchema } from '../schemas/dismantler.schema';
import { Part, PartSchema } from '../schemas/part.schema';
import { Request, RequestSchema } from '../schemas/request.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Store.name, schema: StoreSchema },
      { name: Dismantler.name, schema: DismantlerSchema },
      { name: Part.name, schema: PartSchema },
      { name: Request.name, schema: RequestSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [AIController],
  providers: [AIRecommendationsService, AINotificationsService],
  exports: [AIRecommendationsService, AINotificationsService],
})
export class AIModule {}
