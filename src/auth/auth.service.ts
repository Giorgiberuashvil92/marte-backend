import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Otp, OtpDocument } from '../schemas/otp.schema';
import { Store, StoreDocument } from '../schemas/store.schema';
import { LoginHistoryService } from './login-history.service';
import { SenderAPIService } from '../sms/sender-api.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Otp.name) private otpModel: Model<OtpDocument>,
    @InjectModel(Store.name) private storeModel: Model<StoreDocument>,
    private loginHistoryService: LoginHistoryService,
    private senderAPIService: SenderAPIService,
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

    // Development mode: just log the code instead of sending SMS
    if (process.env.NODE_ENV === 'development') {
      console.log(`📱 [DEV] SMS კოდი ${phone}-ზე: ${code}`);
      return { id: otpId, intent, mockCode: code };
    }

    // Production: Send SMS via sender.ge API
    const smsMessage = `თქვენი ვერიფიკაციის კოდია: ${code}`;
    const smsResult = await this.senderAPIService.sendSMS(phone, smsMessage, 2);

    if (smsResult.success) {
      console.log(
        `📱 [PROD] SMS გაიგზავნა ${phone}-ზე via sender.ge (messageId: ${smsResult.messageId})`,
      );
      return { id: otpId, intent };
    } else {
      console.error(`❌ [SENDER.GE] SMS გაგზავნის შეცდომა: ${smsResult.error}`);
      // Fallback: expose mockCode if SMS sending fails
      console.log(`📱 [FALLBACK] SMS კოდი ${phone}-ზე: ${code}`);
      return { id: otpId, intent, mockCode: code };
    }
  }

  async verify(otpId: string, code: string, _referralCode?: string) {
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
    const isNewUser = !user;

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
    }

    // Update last login time
    user.lastLoginAt = Date.now();
    await user.save();

    // Save login history (async, don't wait for it)
    if (user) {
      this.loginHistoryService
        .createLoginHistory({
          userId: user.id,
          phone: user.phone,
          email: user.email,
          firstName: user.firstName,
          status: 'success',
        })
        .catch((err) => {
          console.error('Error saving login history:', err);
        });
    }

    // Return result - referral code will be applied by frontend after registration
    return { user, intent: isNewUser ? 'register' : 'login' };
  }

  async complete(
    userId: string,
    payload: {
      firstName?: string;
      personalId?: string;
      role?: 'user' | 'partner';
    },
  ) {
    if (!userId) throw new BadRequestException('invalid_user');

    const user = await this.userModel.findOne({ id: userId }).exec();
    if (!user) throw new BadRequestException('user_not_found');

    const updates: UpdateQuery<UserDocument> = { updatedAt: Date.now() };

    if (payload?.firstName && payload.firstName.trim().length > 0) {
      updates.firstName = payload.firstName.trim();
    }

    if (payload?.personalId && payload.personalId.trim().length > 0) {
      updates.personalId = payload.personalId.trim();
    }

    if (payload?.role === 'user' || payload?.role === 'partner') {
      updates.role = payload.role;
    }

    if (Object.keys(updates).length === 1) {
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
    console.log(
      `🔍 [AUTH_SERVICE] updateOwnedCarwashes called with userId: ${userId}, carwashId: ${carwashId}, action: ${action}`,
    );

    if (!userId) throw new BadRequestException('invalid_user');
    if (!carwashId) throw new BadRequestException('invalid_carwash_id');
    if (!action) throw new BadRequestException('invalid_action');

    const user = await this.userModel.findOne({ id: userId }).exec();
    console.log(`🔍 [AUTH_SERVICE] User found:`, user ? 'YES' : 'NO');
    if (!user) {
      console.log(`❌ [AUTH_SERVICE] User not found with id: ${userId}`);
      // Let's also try to find all users to see what IDs exist
      const allUsers = await this.userModel
        .find({})
        .select('id name phone')
        .exec();
      console.log(`🔍 [AUTH_SERVICE] All users in database:`, allUsers);
      throw new BadRequestException('user_not_found');
    }

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

  async updateOwnedStores(
    userId: string,
    storeId: string,
    action: 'add' | 'remove',
  ) {
    console.log(
      `🔍 [AUTH_SERVICE] updateOwnedStores called with userId: ${userId}, storeId: ${storeId}, action: ${action}`,
    );

    if (!userId) throw new BadRequestException('invalid_user');
    if (!storeId) throw new BadRequestException('invalid_store_id');
    if (!action) throw new BadRequestException('invalid_action');

    const user = await this.userModel.findOne({ id: userId }).exec();
    console.log(`🔍 [AUTH_SERVICE] User found:`, user ? 'YES' : 'NO');
    if (!user) {
      console.log(`❌ [AUTH_SERVICE] User not found with id: ${userId}`);
      throw new BadRequestException('user_not_found');
    }

    // Verify store exists
    const store = await this.storeModel.findById(storeId).exec();
    if (!store) {
      throw new NotFoundException('store_not_found');
    }

    const currentOwnedStores = user.ownedStores || [];
    let updatedOwnedStores: string[];

    if (action === 'add') {
      if (currentOwnedStores.includes(storeId)) {
        throw new BadRequestException('store_already_owned');
      }
      updatedOwnedStores = [...currentOwnedStores, storeId];

      // Update store's ownerId to this user's ID
      await this.storeModel
        .findByIdAndUpdate(storeId, {
          ownerId: userId,
        })
        .exec();

      console.log(
        `✅ [AUTH_SERVICE] Store ${storeId} ownerId updated to ${userId}`,
      );
    } else {
      updatedOwnedStores = currentOwnedStores.filter((id) => id !== storeId);
    }

    const updatedUser = await this.userModel
      .findOneAndUpdate(
        { id: userId },
        {
          ownedStores: updatedOwnedStores,
          updatedAt: Date.now(),
        },
        { new: true },
      )
      .exec();

    console.log(
      `✅ [AUTH_SERVICE] User ${userId} ownedStores ${action}ed: ${storeId}`,
    );
    console.log(`✅ [AUTH_SERVICE] Updated ownedStores:`, updatedOwnedStores);

    return {
      success: true,
      message: `Store ${action}ed successfully`,
      user: updatedUser,
    };
  }

  async verifyUser(userId: string) {
    if (!userId) {
      return { exists: false, valid: false };
    }

    const user = await this.userModel.findOne({ id: userId }).exec();

    if (!user) {
      return { exists: false, valid: false };
    }

    // Check if user role is 'customer' - should logout
    if (user.role === 'customer') {
      return { exists: true, valid: false, reason: 'customer_role' };
    }

    return { exists: true, valid: true, user };
  }
}
