import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from '../schemas/category.schema';

export interface CategoryStats {
  totalServices: number;
  averageRating: number;
  totalBookings: number;
  lastUpdated: number;
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  async findAll(): Promise<Category[]> {
    return this.categoryModel
      .find({ isActive: true })
      .sort({ order: 1 })
      .exec();
  }

  async findPopular(limit: number = 6): Promise<Category[]> {
    return this.categoryModel
      .find({ isActive: true })
      .sort({ popularity: -1 })
      .limit(limit)
      .exec();
  }

  async findById(id: string): Promise<Category | null> {
    return this.categoryModel.findById(id).exec();
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.categoryModel.findByIdAndUpdate(id, {
      $inc: { viewCount: 1 },
      updatedAt: new Date(),
    });
  }

  async incrementClickCount(id: string): Promise<void> {
    await this.categoryModel.findByIdAndUpdate(id, {
      $inc: { clickCount: 1 },
      updatedAt: new Date(),
    });
  }

  async updatePopularity(id: string): Promise<void> {
    const category = await this.findById(id);
    if (!category) return;

    // Calculate popularity based on views, clicks, and recency
    const now = Date.now();
    const daysSinceCreated =
      (now - category.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 1 - daysSinceCreated / 365); // Decay over 1 year

    const popularity =
      category.viewCount * 0.3 + category.clickCount * 0.7 + recencyScore * 100;

    await this.categoryModel.findByIdAndUpdate(id, {
      popularity: Math.round(popularity),
      updatedAt: new Date(),
    });
  }

  getCategoryStats(): CategoryStats {
    // This would typically aggregate data from other collections
    // For now, return mock data
    return {
      totalServices: Math.floor(Math.random() * 100) + 10,
      averageRating: 4.0 + Math.random() * 1.0,
      totalBookings: Math.floor(Math.random() * 1000) + 50,
      lastUpdated: Date.now(),
    };
  }

  async create(categoryData: Partial<Category>): Promise<Category> {
    const category = new this.categoryModel({
      ...categoryData,
      popularity: 0,
      viewCount: 0,
      clickCount: 0,
    });
    return category.save();
  }

  async update(
    id: string,
    updates: Partial<Category>,
  ): Promise<Category | null> {
    return this.categoryModel.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true },
    );
  }

  async delete(id: string): Promise<Category | null> {
    return this.categoryModel.findByIdAndUpdate(
      id,
      { isActive: false, updatedAt: new Date() },
      { new: true },
    );
  }

  async getByParentId(parentId: string): Promise<Category[]> {
    return this.categoryModel
      .find({ parentId, isActive: true })
      .sort({ order: 1 })
      .exec();
  }

  async getMainCategories(): Promise<Category[]> {
    return this.categoryModel
      .find({ parentId: { $exists: false }, isActive: true })
      .sort({ order: 1 })
      .exec();
  }

  async searchCategories(query: string): Promise<Category[]> {
    const regex = new RegExp(query, 'i');
    return this.categoryModel
      .find({
        $or: [{ name: regex }, { nameEn: regex }, { description: regex }],
        isActive: true,
      })
      .sort({ popularity: -1 })
      .exec();
  }
}
