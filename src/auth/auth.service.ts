import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Otp, OtpDocument } from '../schemas/otp.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Otp.name) private otpModel: Model<OtpDocument>,
  ) {}

  normalizeGePhone(input: string): string {
    const digits = (input || '').replace(/\D/g, '');
    // strip leading 995 if present, keep last 9 digits
    const local = digits.startsWith('995') ? digits.slice(3) : digits;
    if (local.length !== 9) throw new BadRequestException('invalid_phone');
    return `+995${local}`;
  }

  private generateCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  async start(phoneRaw: string) {
    const phone = this.normalizeGePhone(phoneRaw);

    // check if user exists
    const existingUser = await this.userModel.findOne({ phone }).exec();
    const hasUser = !!existingUser;
    const intent: 'login' | 'register' = hasUser ? 'login' : 'register';

    const code = this.generateCode();
    const now = Date.now();
    const otpId = `otp_${now}`;

    const otp = new this.otpModel({
      id: otpId,
      phone,
      code,
      createdAt: now,
      expiresAt: now + 2 * 60 * 1000, // 2 minutes
      isUsed: false,
    });

    await otp.save();

    // TODO: integrate real SMS provider later
    return { id: otpId, intent, mockCode: code };
  }

  async verify(otpId: string, code: string) {
    if (!otpId || !code) throw new BadRequestException('invalid_payload');

    const otp = await this.otpModel
      .findOne({ id: otpId, isUsed: false })
      .exec();
    if (!otp) throw new BadRequestException('otp_not_found');

    if (Date.now() > otp.expiresAt) {
      throw new BadRequestException('otp_expired');
    }

    if (otp.code !== code) throw new BadRequestException('otp_invalid');

    // upsert user
    let user = await this.userModel.findOne({ phone: otp.phone }).exec();
    let intent: 'login' | 'register';

    if (!user) {
      const userId = `usr_${Date.now()}`;
      user = new this.userModel({
        id: userId,
        phone: otp.phone,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isVerified: false,
        isActive: true,
        role: 'customer',
        ownedCarwashes: [],
      });
      await user.save();
      intent = 'register';
    } else {
      intent = 'login';
    }

    // mark OTP as used
    await this.otpModel
      .updateOne({ id: otpId }, { isUsed: true, usedAt: Date.now() })
      .exec();

    return { user, intent };
  }

  async complete(
    userId: string,
    payload: { firstName?: string; role?: 'user' | 'partner' },
  ) {
    if (!userId) throw new BadRequestException('invalid_user');

    const user = await this.userModel.findOne({ id: userId }).exec();
    if (!user) throw new BadRequestException('user_not_found');

    const updates: any = { updatedAt: Date.now() };

    if (payload?.firstName && payload.firstName.trim().length > 0) {
      updates.firstName = payload.firstName.trim();
    }

    if (payload?.role === 'user' || payload?.role === 'partner') {
      updates.role = payload.role;
    }

    if (Object.keys(updates).length === 1) {
      // only updatedAt
      throw new BadRequestException('no_updates');
    }

    const updatedUser = await this.userModel
      .findOneAndUpdate({ id: userId }, updates, { new: true })
      .exec();

    return { user: updatedUser };
  }

  async updateRole(
    userId: string,
    role: 'customer' | 'owner' | 'manager' | 'employee' | 'user',
  ) {
    if (!userId) throw new BadRequestException('invalid_user');
    if (!role) throw new BadRequestException('invalid_role');

    const user = await this.userModel.findOne({ id: userId }).exec();
    if (!user) throw new BadRequestException('user_not_found');

    const updatedUser = await this.userModel
      .findOneAndUpdate(
        { id: userId },
        { role, updatedAt: Date.now() },
        { new: true },
      )
      .exec();

    console.log(`✅ [AUTH_SERVICE] User ${userId} role updated to: ${role}`);
    return {
      success: true,
      message: 'User role updated successfully',
      user: updatedUser,
    };
  }

  async updateOwnedCarwashes(
    userId: string,
    carwashId: string,
    action: 'add' | 'remove',
  ) {
    if (!userId) throw new BadRequestException('invalid_user');
    if (!carwashId) throw new BadRequestException('invalid_carwash_id');
    if (!action) throw new BadRequestException('invalid_action');

    const user = await this.userModel.findOne({ id: userId }).exec();
    if (!user) throw new BadRequestException('user_not_found');

    const currentOwnedCarwashes = user.ownedCarwashes || [];
    let updatedOwnedCarwashes: string[];

    if (action === 'add') {
      if (currentOwnedCarwashes.includes(carwashId)) {
        throw new BadRequestException('carwash_already_owned');
      }
      updatedOwnedCarwashes = [...currentOwnedCarwashes, carwashId];
    } else {
      updatedOwnedCarwashes = currentOwnedCarwashes.filter(
        (id) => id !== carwashId,
      );
    }

    const updatedUser = await this.userModel
      .findOneAndUpdate(
        { id: userId },
        {
          ownedCarwashes: updatedOwnedCarwashes,
          updatedAt: Date.now(),
        },
        { new: true },
      )
      .exec();

    console.log(
      `✅ [AUTH_SERVICE] User ${userId} ownedCarwashes ${action}ed: ${carwashId}`,
    );
    console.log(
      `✅ [AUTH_SERVICE] Updated ownedCarwashes:`,
      updatedOwnedCarwashes,
    );

    return {
      success: true,
      message: `Carwash ${action}ed successfully`,
      user: updatedUser,
    };
  }
}
