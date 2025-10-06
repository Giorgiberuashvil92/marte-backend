import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  nameEn: string; // English name for API compatibility

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  icon: string; // Icon name or URL

  @Prop({ required: true })
  color: string; // Hex color code

  @Prop({ required: true })
  image: string; // Background image URL

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  order: number; // Display order

  @Prop()
  parentId?: string; // For subcategories

  @Prop({ type: [String], default: [] })
  serviceTypes: string[]; // Related service types

  @Prop({ default: 0 })
  popularity: number; // Calculated popularity score

  @Prop({ default: 0 })
  viewCount: number; // How many times viewed

  @Prop({ default: 0 })
  clickCount: number; // How many times clicked

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

// Create indexes for better performance
CategorySchema.index({ name: 1 });
CategorySchema.index({ isActive: 1, order: 1 });
CategorySchema.index({ popularity: -1 });
CategorySchema.index({ parentId: 1 });
