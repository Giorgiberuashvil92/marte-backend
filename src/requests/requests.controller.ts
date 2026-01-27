import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Request,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { RequestsService } from './requests.service';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  create(@Request() req: ExpressRequest, @Body() dto: any) {
    const userId =
      (req.headers['x-user-id'] as string) || dto.userId || 'demo-user';
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

  @Post(':requestId/responses')
  addResponse(
    @Param('requestId') requestId: string,
    @Body() responseData: any,
  ) {
    return this.requestsService.addResponse(requestId, responseData);
  }

  @Post(':requestId/messages')
  addMessage(@Param('requestId') requestId: string, @Body() messageData: any) {
    return this.requestsService.addMessage(requestId, messageData);
  }

  @Get(':requestId/responses')
  getResponses(@Param('requestId') requestId: string) {
    return this.requestsService.getResponses(requestId);
  }

  @Get(':requestId/messages')
  getMessages(@Param('requestId') requestId: string) {
    return this.requestsService.getMessages(requestId);
  }

  @Get(':requestId/offers')
  getOffers(@Param('requestId') requestId: string) {
    return this.requestsService.getOffers(requestId);
  }
}
