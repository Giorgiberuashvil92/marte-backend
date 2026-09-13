import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { approvalFields, CashbackService, invoiceMime, MAX_INVOICE_BYTES } from './cashback.service';

describe('cashback invoice review', () => {
  const valid = { liters: 45.5, merchantTaxId: '123456789', receiptNumber: 'inv-001' };
  it('calculates integer tetri from verified liters, ignoring client-supplied credits', () => {
    expect(approvalFields({ ...valid, amountTetri: 999999, rateTetri: 999 }).amountTetri).toBe(228);
    expect(approvalFields({ ...valid, liters: 1.234 }).amountTetri).toBe(6);
    expect(approvalFields(valid).receiptKey).toBe('123456789:INV-001');
  });
  it.each([0, -1, NaN, Infinity, 2001, 1.2345, '50', null])('rejects invalid liters %s', liters => {
    expect(() => approvalFields({ ...valid, liters })).toThrow(BadRequestException);
  });
  it('credits only 5 tetri per liter, excluding the 20-tetri pump discount', () => {
    expect(approvalFields({ ...valid, liters: 50, rateTetri: 20 })).toMatchObject({
      amountTetri: 250, rateTetri: 5, verifiedLiters: 50,
    });
  });
  it('requires a receipt identity', () => {
    expect(() => approvalFields({ ...valid, receiptNumber: ' ' })).toThrow(BadRequestException);
    expect(() => approvalFields({ ...valid, merchantTaxId: 'abc' })).toThrow(BadRequestException);
  });
  it('accepts only bounded PDF/JPEG/PNG signatures', () => {
    expect(invoiceMime(Buffer.from('%PDF-1.7'))).toBe('application/pdf');
    expect(invoiceMime(Buffer.from([255,216,255,224]))).toBe('image/jpeg');
    expect(invoiceMime(Buffer.from([137,80,78,71,13,10,26,10]))).toBe('image/png');
    expect(() => invoiceMime(Buffer.from('<svg></svg>'))).toThrow(BadRequestException);
    expect(() => invoiceMime(Buffer.alloc(MAX_INVOICE_BYTES + 1))).toThrow(BadRequestException);
  });
  it('stores uploads as pending without a cashback amount and does not return file data', async () => {
    const model = { create: jest.fn().mockResolvedValue({}) };
    const service = new CashbackService(model as any);
    const result = await service.submit('owner', { buffer: Buffer.from('%PDF-1.7') } as any);
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner', status: 'pending', rateTetri: 5 }));
    expect(model.create.mock.calls[0][0]).not.toHaveProperty('amountTetri');
    expect(result).toEqual({ id: expect.any(String), status: 'pending' });
  });
  it('credits a pending invoice at most once under concurrent review', async () => {
    let pending = true;
    const model = { findOneAndUpdate: jest.fn((filter, update) => ({ lean: async () => {
      expect(filter).toEqual({ id: 'invoice', status: 'pending' });
      if (!pending) return null;
      pending = false;
      return update.$set;
    } })) };
    const service = new CashbackService(model as any);
    const results = await Promise.allSettled([service.review('invoice', 'admin', { ...valid, status: 'approved' }), service.review('invoice', 'admin', { ...valid, status: 'approved' })]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
  });
  it('rejects a second scan of an already approved receipt', async () => {
    const model = { findOneAndUpdate: () => ({ lean: async () => { throw { code: 11000 }; } }) };
    await expect(new CashbackService(model as any).review('invoice', 'admin', { ...valid, status: 'approved' })).rejects.toBeInstanceOf(ConflictException);
  });
  it('requires rejection reason and never creates a credit on rejection', async () => {
    const model = { findOneAndUpdate: jest.fn((_filter: any, _update: any) => ({ lean: async () => ({ status: 'rejected' }) })) };
    const service = new CashbackService(model as any);
    await expect(service.review('invoice', 'admin', { status: 'rejected' })).rejects.toBeInstanceOf(BadRequestException);
    await service.review('invoice', 'admin', { status: 'rejected', reason: 'Unreadable' });
    expect(model.findOneAndUpdate.mock.calls[0][1].$set).not.toHaveProperty('amountTetri');
  });
  it('scopes private file retrieval to its owner', async () => {
    const model = { findOne: jest.fn(() => ({ select: () => ({ exec: async () => null }) })) };
    await expect(new CashbackService(model as any).file('invoice', 'other-user')).rejects.toBeInstanceOf(NotFoundException);
    expect(model.findOne).toHaveBeenCalledWith({ id: 'invoice', userId: 'other-user' });
  });
});
