import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { InsuranceService } from './insurance.service';

const VALID_PRODUCT_TYPES = new Set(['motor', 'mtpl', 'mtpl_premium']);

/** unknown → string უსაფრთხოდ (base-to-string-ის თავიდან ასაცილებლად) */
function asStr(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

@Controller('insurance-leads')
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const firstName = asStr(body?.firstName).trim();
    const lastName = asStr(body?.lastName).trim();
    const personalId = asStr(body?.personalId).trim().replace(/\s/g, '');
    const phone = asStr(body?.phone).trim().replace(/\s/g, '');
    const email = asStr(body?.email).trim().toLowerCase();
    const productType = (asStr(body?.productType) || 'motor').trim();
    const userId =
      typeof body?.userId === 'string' && body.userId.trim()
        ? body.userId.trim()
        : undefined;

    // Lead — მხოლოდ სახელი + ტელეფონი სავალდებულო; დანარჩენს გუნდი დარეკვისას აზუსტებს.
    if (!firstName || firstName.length < 2) {
      return { success: false, error: 'firstName_invalid' };
    }
    if (phone.length < 9) {
      return { success: false, error: 'phone_invalid' };
    }
    if (personalId && !/^\d{11}$/.test(personalId)) {
      return { success: false, error: 'personalId_invalid' };
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'email_invalid' };
    }
    if (!VALID_PRODUCT_TYPES.has(productType)) {
      return { success: false, error: 'productType_invalid' };
    }

    const created = await this.insuranceService.create({
      firstName,
      lastName,
      personalId,
      phone,
      email,
      userId,
      productType,
      planKey:
        typeof body?.planKey === 'string' ? body.planKey.trim() : undefined,
      planLabel:
        typeof body?.planLabel === 'string' ? body.planLabel.trim() : undefined,
      priceMonthly:
        typeof body?.priceMonthly === 'number' ? body.priceMonthly : undefined,
      priceYearly:
        typeof body?.priceYearly === 'number' ? body.priceYearly : undefined,
      carInfo:
        typeof body?.carInfo === 'string' ? body.carInfo.trim() : undefined,
      source:
        typeof body?.source === 'string' && body.source.trim()
          ? body.source.trim()
          : 'insurance_screen',
    });

    const result = created.toJSON ? created.toJSON() : created;
    return { success: true, data: result };
  }

  @Get()
  async list(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedOffset = offset ? Number(offset) : undefined;
    const result = await this.insuranceService.list({
      limit: parsedLimit,
      offset: parsedOffset,
    });
    return { success: true, ...result };
  }

  @Patch(':id')
  async updateOne(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      return { success: false, error: 'invalid_id' };
    }
    const adminNote =
      typeof body?.adminNote === 'string' ? body.adminNote : undefined;
    const called = typeof body?.called === 'boolean' ? body.called : undefined;

    if (adminNote === undefined && called === undefined) {
      return { success: false, error: 'empty_patch' };
    }

    const updated = await this.insuranceService.updateById(id, {
      adminNote,
      called,
    });
    if (!updated) {
      throw new NotFoundException();
    }
    return { success: true, data: updated };
  }
}
