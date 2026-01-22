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
import { CarBrandsService } from './car-brands.service';
import { CreateCarBrandDto } from './dto/create-car-brand.dto';
import { UpdateCarBrandDto } from './dto/update-car-brand.dto';

@Controller('car-brands')
export class CarBrandsController {
  constructor(private readonly carBrandsService: CarBrandsService) {}

  @Post()
  create(@Body() createCarBrandDto: CreateCarBrandDto) {
    return this.carBrandsService.create(createCarBrandDto);
  }

  @Get()
  findAll(@Query('activeOnly') activeOnly?: string) {
    const active = activeOnly === 'true';
    return this.carBrandsService.findAll(active);
  }

  // Specific routes must come before dynamic routes
  @Get('list')
  getBrandsList() {
    return this.carBrandsService.getBrandsList();
  }

  @Get('models/:brandName')
  getModelsByBrand(@Param('brandName') brandName: string) {
    return this.carBrandsService.getModelsByBrand(brandName);
  }

  @Post('import')
  importFromJson(@Body() brandsData?: Record<string, any>) {
    if (brandsData && Object.keys(brandsData).length > 0) {
      return this.carBrandsService.importFromJson(brandsData);
    }
    // If no data provided, try to import from file
    return this.carBrandsService.importFromFile();
  }

  // Dynamic routes come after specific routes
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.carBrandsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCarBrandDto: UpdateCarBrandDto,
  ) {
    return this.carBrandsService.update(id, updateCarBrandDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.carBrandsService.remove(id);
  }

  // POST /:id/models must come before DELETE /:id/models/:modelName
  @Post(':id/models')
  addModel(@Param('id') id: string, @Body() body: any) {
    // Handle multiple formats:
    // 1. {modelName: "Camry"}
    // 2. {modelName: {name: "Camry"}}
    // 3. {name: "Camry"} - for admin panel compatibility
    let modelName: string | { name: string } | undefined = body.modelName;

    // If modelName is not provided but name is, use name
    if (!modelName && body.name) {
      modelName = body.name;
    }

    return this.carBrandsService.addModel(id, modelName);
  }

  @Delete(':id/models/:modelName')
  removeModel(@Param('id') id: string, @Param('modelName') modelName: string) {
    return this.carBrandsService.removeModel(id, modelName);
  }
}
