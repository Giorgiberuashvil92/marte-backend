import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DeliveryLeadsService } from './delivery-leads.service';

@Controller('delivery-leads')
export class DeliveryLeadsController {
  constructor(private readonly deliveryLeadsService: DeliveryLeadsService) {}

  @Post()
  async create(@Body() body: Record<string, any>) {
    const firstName = String(body?.firstName || '').trim();
    const phone = String(body?.phone || '').replace(/\s/g, '');
    const address = String(body?.address || '').trim();
    const itemDetails = String(body?.itemDetails || '').trim();

    if (firstName.length < 2) {
      return { success: false, error: 'firstName_invalid' };
    }
    if (phone.length < 9) {
      return { success: false, error: 'phone_invalid' };
    }
    if (address.length < 5) {
      return { success: false, error: 'address_invalid' };
    }
    if (itemDetails.length < 2) {
      return { success: false, error: 'itemDetails_invalid' };
    }

    const created = await this.deliveryLeadsService.create({
      firstName,
      phone,
      address,
      itemDetails,
      userId:
        typeof body?.userId === 'string' && body.userId.trim()
          ? body.userId.trim()
          : undefined,
      productType:
        typeof body?.productType === 'string' ? body.productType : 'parts_call',
      productTitle:
        typeof body?.productTitle === 'string'
          ? body.productTitle
          : 'მიტანის მოთხოვნა',
      source:
        typeof body?.source === 'string' ? body.source : 'delivery_request',
      items: Array.isArray(body?.items) ? body.items : [],
      totalPrice: Number(body?.totalPrice) || 0,
      status: 'new',
    });

    const result = created.toJSON ? created.toJSON() : created;
    return { success: true, data: result };
  }

  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ) {
    const result = await this.deliveryLeadsService.list({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      status,
      userId:
        typeof userId === 'string' && userId.trim() ? userId.trim() : undefined,
    });
    return { success: true, ...result };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, any>) {
    const updated = await this.deliveryLeadsService.update(id, {
      status: typeof body?.status === 'string' ? body.status : undefined,
      adminNote:
        typeof body?.adminNote === 'string' ? body.adminNote : undefined,
    });
    return { success: true, data: updated };
  }
}
