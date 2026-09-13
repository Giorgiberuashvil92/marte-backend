import { UnauthorizedException } from '@nestjs/common';
import { UserSessionGuard, UserSessionService } from './user-session';
import { createHash } from 'crypto';
describe('cashback user authentication', () => {
  it('stores only token digests and sets an expiry', async () => {
    const sessions = { create: jest.fn().mockResolvedValue({}) };
    const token = await new UserSessionService(sessions as any, {} as any).issue('owner');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(sessions.create).toHaveBeenCalledWith({ userId: 'owner', digest: createHash('sha256').update(token).digest('hex'), expiresAt: expect.any(Date) });
  });
  it('rejects a caller-supplied user ID without a session', async () => {
    const service = new UserSessionService({} as any, {} as any);
    const guard = new UserSessionGuard(service);
    const context = { switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-user-id': 'victim' } }) }) };
    await expect(guard.canActivate(context as any)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('looks up only unexpired sessions and refuses inactive users', async () => {
    const sessions = { findOne: jest.fn(() => ({ lean: async () => ({ userId: 'owner' }) })) };
    const users = { exists: jest.fn().mockResolvedValue(null) };
    await expect(new UserSessionService(sessions as any, users as any).verify('a'.repeat(64))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.findOne).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: { $gt: expect.any(Date) } }));
    expect(users.exists).toHaveBeenCalledWith({ id: 'owner', isActive: true });
  });
});
