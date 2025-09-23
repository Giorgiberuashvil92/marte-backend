/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Headers,
} from '@nestjs/common';
import { OffersService } from './offers.service';

@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post()
  create(@Body() dto: any, @Headers('x-user-id') userId?: string) {
    const normalized = {
      ...dto,
      userId: dto?.userId || userId || 'demo-user',
      reqId: dto?.reqId || dto?.requestId,
    };
    return this.offersService.create(normalized);
  }

  @Get()
  findAll(
    @Query('reqId') reqId?: string,
    @Query('requestId') requestId?: string,
    @Query('userId') userId?: string,
    @Query('partnerId') partnerId?: string,
  ) {
    const finalReqId = reqId || requestId; // support both reqId and requestId
    return this.offersService.findAll(finalReqId, userId, partnerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.offersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.offersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.offersService.remove(id);
  }
}
