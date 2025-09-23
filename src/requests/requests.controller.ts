import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Request } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { RequestsService } from './requests.service';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  create(@Request() req: ExpressRequest, @Body() dto: any) {
    const userId = (req.headers['x-user-id'] as string) || dto.userId || 'demo-user';
    return this.requestsService.create({ ...dto, userId });
  }

  @Get()
  findAll(@Query('userId') userId?: string) {
    return this.requestsService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.requestsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.requestsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.requestsService.remove(id);
  }
}


