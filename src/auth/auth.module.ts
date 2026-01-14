import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LoginHistoryService } from './login-history.service';
import { LoginHistoryController } from './login-history.controller';
import { User, UserSchema } from '../schemas/user.schema';
import { Otp, OtpSchema } from '../schemas/otp.schema';
import {
  LoginHistory,
  LoginHistorySchema,
} from '../schemas/login-history.schema';
import { Store, StoreSchema } from '../schemas/store.schema';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Otp.name, schema: OtpSchema },
      { name: LoginHistory.name, schema: LoginHistorySchema },
      { name: Store.name, schema: StoreSchema },
    ]),
    SmsModule,
  ],
  controllers: [AuthController, LoginHistoryController],
  providers: [AuthService, LoginHistoryService],
  exports: [AuthService, LoginHistoryService],
})
export class AuthModule {}
