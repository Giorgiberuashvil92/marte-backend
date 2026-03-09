import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  NewsArticle,
  NewsArticleDocument,
} from '../schemas/news-article.schema';

@Injectable()
export class NewsFeedService {
  constructor(
    @InjectModel(NewsArticle.name)
    private newsArticleModel: Model<NewsArticleDocument>,
  ) {}

  async create(payload: {
    title: string;
    summary: string;
    category?: string;
    image?: string;
    body?: string;
    publishedAt?: Date;
  }) {
    const doc = new this.newsArticleModel({
      ...payload,
      category: payload.category ?? 'general',
      views: 0,
      likes: 0,
      isActive: true,
      publishedAt: payload.publishedAt ?? new Date(),
    });
    return doc.save();
  }

  async findAll(activeOnly = true) {
    const filter: any = {};
    if (activeOnly) {
      filter.isActive = true;
    }
    const list = await this.newsArticleModel
      .find(filter)
      .sort({ publishedAt: -1 })
      .lean()
      .exec();
    return list.map((item: any) => ({
      ...item,
      id: item._id?.toString(),
      _id: undefined,
      publishedAt: item.publishedAt instanceof Date
        ? item.publishedAt.toISOString()
        : item.publishedAt,
    }));
  }

  async findOne(id: string) {
    const doc = await this.newsArticleModel.findById(id).lean();
    if (!doc) {
      throw new NotFoundException('სტატია ვერ მოიძებნა');
    }
    const item = doc as any;
    return {
      ...item,
      id: item._id?.toString(),
      _id: undefined,
      publishedAt: item.publishedAt instanceof Date
        ? item.publishedAt.toISOString()
        : item.publishedAt,
    };
  }

  async update(
    id: string,
    updates: Partial<{
      title: string;
      summary: string;
      category: string;
      image: string;
      body: string;
      isActive: boolean;
      publishedAt: Date;
    }>,
  ) {
    const updated = await this.newsArticleModel
      .findByIdAndUpdate(id, updates, { new: true })
      .lean();
    if (!updated) {
      throw new NotFoundException('სტატია ვერ მოიძებნა');
    }
    const item = updated as any;
    return {
      ...item,
      id: item._id?.toString(),
      _id: undefined,
      publishedAt: item.publishedAt instanceof Date
        ? item.publishedAt.toISOString()
        : item.publishedAt,
    };
  }

  async delete(id: string) {
    const deleted = await this.newsArticleModel.findByIdAndDelete(id).lean();
    if (!deleted) {
      throw new NotFoundException('სტატია ვერ მოიძებნა');
    }
    const item = deleted as any;
    return {
      ...item,
      id: item._id?.toString(),
      _id: undefined,
    };
  }

  async incrementViews(id: string) {
    const doc = await this.newsArticleModel.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true },
    ).lean();
    if (!doc) {
      throw new NotFoundException('სტატია ვერ მოიძებნა');
    }
    return doc;
  }
}
