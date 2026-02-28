import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { EcommerceProductsService } from './ecommerce-products.service';
import { CreateEcommerceProductDto } from './dto/create-ecommerce-product.dto';
import { UpdateEcommerceProductDto } from './dto/update-ecommerce-product.dto';

@Controller('ecommerce-products')
export class EcommerceProductsController {
  constructor(
    private readonly ecommerceProductsService: EcommerceProductsService,
  ) {}

  @Post()
  async create(@Body() createProductDto: CreateEcommerceProductDto) {
    try {
      const product =
        await this.ecommerceProductsService.create(createProductDto);
      return {
        success: true,
        message: 'პროდუქტი წარმატებით დაემატა',
        data: product,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'პროდუქტის დამატება ვერ მოხერხდა',
      };
    }
  }

  @Get()
  async findAll(
    @Query('category') category?: string,
    @Query('brand') brand?: string,
    @Query('isActive') isActive?: string,
    @Query('isFeatured') isFeatured?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const filters: any = {
        category,
        brand,
        search,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      };

      if (isActive !== undefined) {
        filters.isActive = isActive === 'true';
      }

      if (isFeatured !== undefined) {
        filters.isFeatured = isFeatured === 'true';
      }

      const products = await this.ecommerceProductsService.findAll(filters);
      return {
        success: true,
        message: 'პროდუქტები წარმატებით ჩამოიტვირთა',
        data: products,
        count: products.length,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'პროდუქტების ჩატვირთვა ვერ მოხერხდა',
        data: [],
      };
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const product = await this.ecommerceProductsService.findOne(id);
      return {
        success: true,
        message: 'პროდუქტი წარმატებით ჩამოიტვირთა',
        data: product,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'პროდუქტი ვერ მოიძებნა',
      };
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateEcommerceProductDto,
  ) {
    try {
      const product = await this.ecommerceProductsService.update(
        id,
        updateProductDto,
      );
      return {
        success: true,
        message: 'პროდუქტი წარმატებით განახლდა',
        data: product,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'პროდუქტის განახლება ვერ მოხერხდა',
      };
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.ecommerceProductsService.remove(id);
      return {
        success: true,
        message: 'პროდუქტი წარმატებით წაიშალა',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'პროდუქტის წაშლა ვერ მოხერხდა',
      };
    }
  }
}
