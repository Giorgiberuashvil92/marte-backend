import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { CarBrand, CarBrandDocument } from '../schemas/car-brand.schema';
import { CreateCarBrandDto } from './dto/create-car-brand.dto';
import { UpdateCarBrandDto } from './dto/update-car-brand.dto';

@Injectable()
export class CarBrandsService {
  constructor(
    @InjectModel(CarBrand.name)
    private carBrandModel: Model<CarBrandDocument>,
  ) {}

  async create(createCarBrandDto: CreateCarBrandDto): Promise<CarBrand> {
    // Check if brand already exists
    const existingBrand = await this.findByName(createCarBrandDto.name);
    if (existingBrand) {
      // Update existing brand instead of creating duplicate
      const id =
        (existingBrand as any)._id?.toString() || (existingBrand as any).id;
      if (id) {
        return this.update(id, createCarBrandDto);
      }
    }

    const createdBrand = new this.carBrandModel(createCarBrandDto);
    return createdBrand.save();
  }

  async findAll(activeOnly: boolean = false): Promise<CarBrand[]> {
    const filter = activeOnly ? { isActive: true } : {};
    const brands = await this.carBrandModel
      .find(filter)
      .sort({ order: 1, name: 1 })
      .exec();

    // Clean up null values from models arrays
    for (const brand of brands) {
      if (
        brand.models &&
        brand.models.some((m: any) => m == null || m === '')
      ) {
        brand.models = brand.models.filter(
          (m: any) => m != null && m !== '' && typeof m === 'string',
        );
        await brand.save();
      }
    }

    return brands;
  }

  async findOne(id: string): Promise<CarBrand> {
    const brand = await this.carBrandModel.findById(id).exec();
    if (!brand) {
      throw new NotFoundException(`Car brand with ID ${id} not found`);
    }
    return brand;
  }

  async findByName(name: string): Promise<CarBrand | null> {
    return this.carBrandModel.findOne({ name }).exec();
  }

  async getBrandsList(): Promise<{ name: string; models: string[] }[]> {
    const brands = await this.carBrandModel
      .find({ isActive: true })
      .sort({ order: 1, name: 1 })
      .select('name models')
      .exec();

    return brands.map((brand) => ({
      name: brand.name,
      models: (brand.models || []).filter((m) => m != null && m !== ''),
    }));
  }

  async getModelsByBrand(brandName: string): Promise<string[]> {
    const brand = await this.carBrandModel
      .findOne({ name: brandName, isActive: true })
      .select('models')
      .exec();

    return brand?.models || [];
  }

  async update(
    id: string,
    updateCarBrandDto: UpdateCarBrandDto,
  ): Promise<CarBrand> {
    const updatedBrand = await this.carBrandModel
      .findByIdAndUpdate(id, updateCarBrandDto, { new: true })
      .exec();

    if (!updatedBrand) {
      throw new NotFoundException(`Car brand with ID ${id} not found`);
    }

    return updatedBrand;
  }

  async remove(id: string): Promise<void> {
    const result = await this.carBrandModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Car brand with ID ${id} not found`);
    }
  }

  async addModel(
    brandId: string,
    modelName: string | { name: string } | undefined,
  ): Promise<CarBrand> {
    const brand = await this.carBrandModel.findById(brandId).exec();
    if (!brand) {
      throw new NotFoundException(`Car brand with ID ${brandId} not found`);
    }

    // Handle both string and object format
    let modelNameStr = '';
    if (typeof modelName === 'string') {
      modelNameStr = modelName;
    } else if (
      modelName &&
      typeof modelName === 'object' &&
      'name' in modelName
    ) {
      modelNameStr = modelName.name || '';
    } else if (!modelName) {
      throw new NotFoundException('Model name is required');
    }

    if (!modelNameStr || !modelNameStr.trim()) {
      throw new NotFoundException('Model name is required');
    }

    // Filter out null/undefined values from models array
    brand.models = (brand.models || []).filter((m) => m != null && m !== '');

    if (!brand.models.includes(modelNameStr)) {
      brand.models.push(modelNameStr);
      await brand.save();
    }

    return brand;
  }

  async removeModel(brandId: string, modelName: string): Promise<CarBrand> {
    const brand = await this.carBrandModel.findById(brandId).exec();
    if (!brand) {
      throw new NotFoundException(`Car brand with ID ${brandId} not found`);
    }

    brand.models = brand.models.filter((m) => m !== modelName);
    await brand.save();

    return brand;
  }

  async importFromJson(brandsData: Record<string, any>): Promise<{
    created: number;
    updated: number;
    errors: string[];
  }> {
    const result = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const [brandKey, brandData] of Object.entries(brandsData)) {
      try {
        const brandName = brandData.name || brandKey;
        // Filter out null/undefined/empty values from models
        const models = (brandData.models || []).filter(
          (m: any) => m != null && m !== '' && typeof m === 'string',
        );
        const country = brandData.country;
        const logo = brandData.logo;

        const existingBrand = await this.findByName(brandName);

        if (existingBrand) {
          // Update existing brand
          const id =
            (
              existingBrand as unknown as {
                _id?: string | undefined;
                id?: string | undefined;
              }
            )._id?.toString() ||
            (existingBrand as unknown as { id?: string | undefined }).id;
          if (id) {
            await this.update(id, {
              models,
              country,
              logo,
              isActive: true,
            });
            result.updated++;
          }
        } else {
          // Create new brand
          await this.create({
            name: brandName,
            models,
            country,
            logo,
            isActive: true,
            order: 0,
          });
          result.created++;
        }
      } catch (error: any) {
        result.errors.push(
          `Error processing brand ${brandKey}: ${error.message}`,
        );
      }
    }

    return result;
  }

  async importFromFile(): Promise<{
    created: number;
    updated: number;
    errors: string[];
  }> {
    try {
      // Try to read carData.json from different possible locations
      const possiblePaths = [
        path.join(process.cwd(), 'data', 'carData.json'),
        path.join(process.cwd(), '..', 'data', 'carData.json'),
        path.join(__dirname, '..', '..', '..', 'data', 'carData.json'),
      ];

      let carDataPath: string | null = null;
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          carDataPath = possiblePath;
          break;
        }
      }

      if (!carDataPath) {
        throw new Error('carData.json file not found in any expected location');
      }

      const carData = JSON.parse(fs.readFileSync(carDataPath, 'utf-8'));
      const brandsData = carData.brands || {};

      return this.importFromJson(brandsData);
    } catch (error: any) {
      return {
        created: 0,
        updated: 0,
        errors: [`Failed to import from file: ${error.message}`],
      };
    }
  }
}
