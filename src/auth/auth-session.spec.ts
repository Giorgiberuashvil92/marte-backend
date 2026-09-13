import { AuthService } from './auth.service';
import { BadRequestException } from '@nestjs/common';
describe('OTP-backed invoice sessions', () => {
  function setup(attempt: any, consumed: any) {
    const otp = { findOneAndUpdate: jest.fn().mockReturnValueOnce({ exec: async () => attempt }).mockReturnValueOnce({ exec: async () => consumed }) };
    const user = { id: 'owner', save: jest.fn().mockResolvedValue(undefined) };
    const users = { findOne: jest.fn(() => ({ exec: async () => user })) };
    const sessions = { issue: jest.fn().mockResolvedValue('secure-token') };
    const service = new AuthService(users as any, otp as any, {} as any, { createLoginHistory: async () => undefined } as any, {} as any, sessions as any);
    return { service, sessions, otp };
  }
  it('issues a session only after a correct OTP is consumed', async () => {
    const { service, sessions, otp } = setup({ code: '4321' }, { phone: '+995555555555' });
    const result = await service.verify('otp-id', '4321');
    expect(result.sessionToken).toBe('secure-token');
    expect(sessions.issue).toHaveBeenCalledWith('owner');
    expect(otp.findOneAndUpdate.mock.calls[1][1]).toEqual({ $set: { isUsed: true, usedAt: expect.any(Number) } });
  });
  it.each([null, { code: '9999' }])('does not issue a session for expired/exhausted or incorrect codes', async attempt => {
    const { service, sessions } = setup(attempt, null);
    await expect(service.verify('otp-id', '4321')).rejects.toBeInstanceOf(BadRequestException);
    expect(sessions.issue).not.toHaveBeenCalled();
  });
  it('refuses a concurrently consumed/replayed code', async () => {
    const { service, sessions } = setup({ code: '4321' }, null);
    await expect(service.verify('otp-id', '4321')).rejects.toBeInstanceOf(BadRequestException);
    expect(sessions.issue).not.toHaveBeenCalled();
  });
});
