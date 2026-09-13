import { FUEL_CASHBACK_TETRI } from './cashback-policy';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomUUID } from 'crypto';
import { CashbackInvoice } from './cashback.schema';

export const MAX_INVOICE_BYTES = 8 * 1024 * 1024;
export function invoiceMime(buffer: Buffer): string {
  if (!buffer?.length || buffer.length > MAX_INVOICE_BYTES) throw new BadRequestException('ფაილის მაქსიმალური ზომაა 8 MB');
  if (buffer.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  throw new BadRequestException('ატვირთეთ PDF, JPG ან PNG ინვოისი');
}
export function approvalFields(body: any) {
  const liters = body?.liters;
  if (typeof liters !== 'number' || !Number.isFinite(liters) || liters <= 0 || liters > 2000 || Math.abs(liters * 1000 - Math.round(liters * 1000)) > 1e-6) {
    throw new BadRequestException('ლიტრები უნდა იყოს 0-ზე მეტი, მაქსიმუმ 2000, არაუმეტეს 3 ათწილადით');
  }
  const merchant = typeof body.merchantTaxId === 'string' ? body.merchantTaxId.trim() : '';
  const receipt = typeof body.receiptNumber === 'string' ? body.receiptNumber.trim().toUpperCase() : '';
  if (!/^\d{9,11}$/.test(merchant) || !receipt || receipt.length > 100) throw new BadRequestException('შეავსეთ გამყიდველის საიდენტიფიკაციო და ინვოისის ნომერი');
  const amountTetri = Math.round(Math.round(liters * 1000) * FUEL_CASHBACK_TETRI / 1000);
  if (amountTetri < 1) throw new BadRequestException('ქეშბექი მინიმუმ 1 თეთრი უნდა იყოს');
  return { verifiedLiters: liters, amountTetri, rateTetri: FUEL_CASHBACK_TETRI, receiptKey: `${merchant}:${receipt}` };
}
@Injectable()
export class CashbackService {
  constructor(@InjectModel(CashbackInvoice.name) private invoices: Model<CashbackInvoice>) {}
  async submit(userId: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('აირჩიეთ ინვოისი');
    const mimeType = invoiceMime(file.buffer);
    const extension = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg';
    const id = randomUUID();
    try {
      await this.invoices.create({ id, userId, file: file.buffer, mimeType, fileName: `invoice-${id}.${extension}`, fileHash: createHash('sha256').update(file.buffer).digest('hex'), status: 'pending', rateTetri: FUEL_CASHBACK_TETRI });
      return { id, status: 'pending' };
    } catch (e) {
      if (e?.code === 11000) throw new ConflictException('ეს ინვოისი უკვე ატვირთულია');
      throw e;
    }
  }
  async summary(userId: string) {
    const shifted = new Date(Date.now() + 4 * 3600000);
    const start = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - 4 * 3600000);
    const rows = await this.invoices.aggregate([
      { $match: { userId } },
      { $group: { _id: null,
        approvedTetri: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$amountTetri', 0] } },
        monthTetri: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'approved'] }, { $gte: ['$reviewedAt', start] }] }, '$amountTetri', 0] } },
        pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
      } },
    ]);
    return { approvedTetri: rows[0]?.approvedTetri || 0, monthTetri: rows[0]?.monthTetri || 0, pendingCount: rows[0]?.pendingCount || 0, rateTetri: FUEL_CASHBACK_TETRI, monthDay: shifted.getUTCDate(), monthDays: new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate() };
  }
  async list(userId?: string, page = 0, status?: string) {
    const filter: any = userId ? { userId } : {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) filter.status = status;
    const items = await this.invoices.find(filter).sort({ createdAt: -1, _id: -1 }).skip(page * 30).limit(31).lean();
    return { items: items.slice(0, 30), hasMore: items.length > 30 };
  }
  async file(id: string, userId?: string) {
    const invoice = await this.invoices.findOne({ id, ...(userId ? { userId } : {}) }).select('+file').exec();
    if (!invoice) throw new NotFoundException();
    return invoice;
  }
  async review(id: string, reviewer: string, body: any) {
    if (!body || !['approved', 'rejected'].includes(body.status)) throw new BadRequestException('არასწორი სტატუსი');
    const fields = body.status === 'approved' ? approvalFields(body) : { rejectionReason: typeof body.reason === 'string' ? body.reason.trim() : '' };
    if (body.status === 'rejected' && (!(fields as any).rejectionReason || (fields as any).rejectionReason.length > 500)) throw new BadRequestException('მიუთითეთ უარის მიზეზი (მაქს. 500 სიმბოლო)');
    try {
      // The invoice itself is the ledger entry: a concurrent/repeated review cannot credit it twice.
      const updated = await this.invoices.findOneAndUpdate({ id, status: 'pending' }, { $set: { ...fields, status: body.status, reviewedAt: new Date(), reviewedBy: reviewer } }, { new: true }).lean();
      if (!updated) throw new ConflictException('ინვოისი უკვე განხილულია ან ვერ მოიძებნა');
      return updated;
    } catch (e) {
      if (e?.code === 11000) throw new ConflictException('ამ გამყიდველის ეს ინვოისი უკვე დადასტურებულია');
      throw e;
    }
  }
}
