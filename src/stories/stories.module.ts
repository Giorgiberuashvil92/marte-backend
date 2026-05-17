import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';
import { Story, StorySchema } from '../schemas/story.schema';
import {
  CommunityGroup,
  CommunityGroupSchema,
} from '../schemas/community-group.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Story.name, schema: StorySchema },
      { name: CommunityGroup.name, schema: CommunityGroupSchema },
    ]),
  ],
  controllers: [StoriesController],
  providers: [StoriesService],
})
export class StoriesModule {}
