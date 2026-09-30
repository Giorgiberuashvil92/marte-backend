import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PartLeadsService } from './part-leads.service';

@Controller('part-leads')
export class PartLeadsController {
  constructor(private readonly partLeadsService: PartLeadsService) {}

  @Post()
  create(@Body() body: Record<string, unknown>) {
    return this.partLeadsService.create(body);
  }

  @Get()
  list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('partId') partId?: string,
  ) {
    return this.partLeadsService.list({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      status: this.clean(status),
      userId: this.clean(userId),
      partId: this.clean(partId),
    });
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.partLeadsService.updateStatus(
      id,
      this.clean(body?.status) || '',
    );
  }

  private clean(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
