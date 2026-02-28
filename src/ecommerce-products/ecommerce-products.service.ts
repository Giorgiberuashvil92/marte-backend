import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateEcommerceProductDto } from './dto/create-ecommerce-product.dto';
import { UpdateEcommerceProductDto } from './dto/update-ecommerce-product.dto';
import {
  EcommerceProduct,
  EcommerceProductDocument,
} from '../schemas/ecommerce-product.schema';

@Injectable()
export class EcommerceProductsService {
  constructor(
    @InjectModel(EcommerceProduct.name)
    private productModel: Model<EcommerceProductDocument>,
  ) {}

  async create(
    createProductDto: CreateEcommerceProductDto,
  ): Promise<EcommerceProduct> {
    const newProduct = new this.productModel({
      ...createProductDto,
      inStock: createProductDto.inStock ?? (createProductDto.stock ?? 0) > 0,
    });
    return newProduct.save();
  }

  async findAll(filters?: {
    category?: string;
    brand?: string;
    isActive?: boolean;
    isFeatured?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<EcommerceProduct[]> {
    const query: Record<string, any> = {};

    if (filters?.category) {
      query.category = filters.category;
    }

    if (filters?.brand) {
      query.brand = filters.brand;
    }

    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters?.isFeatured !== undefined) {
      query.isFeatured = filters.isFeatured;
    }

    if (filters?.search) {
      query.$or = [
        { title: new RegExp(filters.search, 'i') },
        { description: new RegExp(filters.search, 'i') },
        { brand: new RegExp(filters.search, 'i') },
      ];
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    return this.productModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async findOne(id: string): Promise<EcommerceProduct> {
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new Error('Product not found');
    }

    // Increment views
    product.views = (product.views || 0) + 1;
    await product.save();

    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateEcommerceProductDto,
  ): Promise<EcommerceProduct> {
    if (updateProductDto.stock !== undefined) {
      updateProductDto.inStock = updateProductDto.stock > 0;
    }

    const updatedProduct = await this.productModel
      .findByIdAndUpdate(id, updateProductDto, { new: true })
      .exec();

    if (!updatedProduct) {
      throw new Error('Product not found');
    }

    return updatedProduct;
  }

  async remove(id: string): Promise<void> {
    await this.productModel.findByIdAndDelete(id).exec();
  }

  async incrementSales(id: string, quantity: number = 1): Promise<void> {
    await this.productModel
      .findByIdAndUpdate(id, {
        $inc: { sales: quantity, stock: -quantity },
      })
      .exec();
  }
}
