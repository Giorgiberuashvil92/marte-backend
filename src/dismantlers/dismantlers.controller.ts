import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  BadRequestException,
  NotFoundException,
  Request,
} from '@nestjs/common';
import { CreateDismantlerDto } from './dto/create-dismantler.dto';
import { UpdateDismantlerDto } from './dto/update-dismantler.dto';
import { DismantlersService } from './dismantlers.service';

@Controller('dismantlers')
export class DismantlersController {
  constructor(private readonly dismantlersService: DismantlersService) {}

  @Post()
  async create(@Request() req: any, @Body() createDismantlerDto: CreateDismantlerDto) {
    console.log('🚀 DismantlersController.create called');
    
    // Get userId from headers (sent by frontend)
    const userId = req.headers['x-user-id'] || 'demo-user';
    console.log('👤 User ID from headers:', userId);
    
    console.log(
      '📝 Request body:',
      JSON.stringify(createDismantlerDto, null, 2),
    );

    try {
      console.log('✅ Validation passed, calling service...');
      const data = await this.dismantlersService.create({
        ...createDismantlerDto,
        ownerId: userId,
      });
      console.log('✅ Service returned:', JSON.stringify(data, null, 2));

      return {
        success: true,
        message: 'დაშლილების განცხადება წარმატებით შეიქმნა',
        data,
      };
    } catch (error) {
      console.error('❌ Error in create:', error);
      console.error('❌ Error message:', error?.message);
      console.error('❌ Error stack:', error?.stack);

      throw new BadRequestException({
        success: false,
        message: error.message as string,
      });
    }
  }

  @Get()
  async findAll(
    @Query('brand') brand?: string,
    @Query('model') model?: string,
    @Query('yearFrom') yearFrom?: string,
    @Query('yearTo') yearTo?: string,
    @Query('location') location?: string,
    @Query('status') status?: string,
    @Query('ownerId') ownerId?: string,
  ) {
    const filters = {
      brand,
      model,
      yearFrom: yearFrom ? parseInt(yearFrom) : undefined,
      yearTo: yearTo ? parseInt(yearTo) : undefined,
      location,
      status,
      ownerId,
    };

    const dismantlers = await this.dismantlersService.findAll(filters);

    return {
      success: true,
      message: 'დაშლილების განცხადებები წარმატებით ჩამოიტვირთა',
      data: dismantlers,
      count: dismantlers.length,
    };
  }

  @Get('featured')
  async getFeatured() {
    const featured = await this.dismantlersService.getFeatured();
    return {
      success: true,
      message: 'რეკომენდებული დაშლილები',
      data: featured,
    };
  }

  @Get('search')
  async search(@Query('q') keyword: string) {
    if (!keyword) {
      throw new BadRequestException({
        success: false,
        message: 'საძიებო სიტყვა აუცილებელია',
      });
    }

    const results = await this.dismantlersService.searchByKeyword(keyword);
    return {
      success: true,
      message: 'ძიების შედეგები',
      data: results,
    };
  }

  @Get('brand/:brand')
  async getByBrand(@Param('brand') brand: string) {
    const results = await this.dismantlersService.getByBrand(brand);
    return {
      success: true,
      message: `${brand} ბრენდის დაშლილები`,
      data: results,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const result = await this.dismantlersService.findOne(id);
      return {
        success: true,
        message: 'დაშლილების განცხადება',
        data: result,
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: error.message as string,
      });
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDismantlerDto: UpdateDismantlerDto,
  ) {
    try {
      const result = await this.dismantlersService.update(
        id,
        updateDismantlerDto,
      );
      return {
        success: true,
        message: 'დაშლილების განცხადება წარმატებით განახლდა',
        data: result,
      };
    } catch (error) {
      if (error.message?.includes('ვერ მოიძებნა')) {
        throw new NotFoundException({
          success: false,
          message: error.message as string,
        });
      }
      throw new BadRequestException({
        success: false,
        message: error.message as string,
      });
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.dismantlersService.remove(id);
      return {
        success: true,
        message: 'დაშლილების განცხადება წარმატებით წაიშალა',
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: error.message as string,
      });
    }
  }
}
