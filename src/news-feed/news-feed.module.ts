import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NewsFeedController } from './news-feed.controller';
import { NewsFeedService } from './news-feed.service';
import {
  NewsArticle,
  NewsArticleSchema,
} from '../schemas/news-article.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NewsArticle.name, schema: NewsArticleSchema },
    ]),
  ],
  controllers: [NewsFeedController],
  providers: [NewsFeedService],
  exports: [NewsFeedService],
})
export class NewsFeedModule {}
