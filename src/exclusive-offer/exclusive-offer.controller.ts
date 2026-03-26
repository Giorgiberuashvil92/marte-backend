import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ExclusiveOfferService } from './exclusive-offer.service';

@Controller('exclusive-offer-requests')
export class ExclusiveOfferController {
  constructor(private readonly exclusiveOfferService: ExclusiveOfferService) {}

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const firstName = String(body?.firstName ?? '').trim();
    const lastName = String(body?.lastName ?? '').trim();
    const personalId = String(body?.personalId ?? '')
      .trim()
      .replace(/\s/g, '');
    const phone = String(body?.phone ?? '').trim().replace(/\s/g, '');
    const email = String(body?.email ?? '').trim().toLowerCase();
    const userId =
      typeof body?.userId === 'string' && body.userId.trim()
        ? body.userId.trim()
        : undefined;

    if (!firstName || firstName.length < 2) {
      return { success: false, error: 'firstName_invalid' };
    }
    if (!lastName || lastName.length < 2) {
      return { success: false, error: 'lastName_invalid' };
    }
    if (!/^\d{11}$/.test(personalId)) {
      return { success: false, error: 'personalId_invalid' };
    }
    if (phone.length < 9) {
      return { success: false, error: 'phone_invalid' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'email_invalid' };
    }

    const created = await this.exclusiveOfferService.create({
      firstName,
      lastName,
      personalId,
      phone,
      email,
      userId,
      source:
        typeof body?.source === 'string' && body.source.trim()
          ? body.source.trim()
          : 'fuel_exclusive_portal',
    });

    const result = created.toJSON ? created.toJSON() : created;
    return { success: true, data: result };
  }

  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedOffset = offset ? Number(offset) : undefined;
    const result = await this.exclusiveOfferService.list({
      limit: parsedLimit,
      offset: parsedOffset,
    });
    return { success: true, ...result };
  }
}
