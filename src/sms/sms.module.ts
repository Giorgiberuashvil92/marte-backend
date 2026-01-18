import { Module } from '@nestjs/common';
import { SenderAPIService } from './sender-api.service';
import { SmsController } from './sms.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [SenderAPIService],
  controllers: [SmsController],
  exports: [SenderAPIService], // Export so other modules can use it
})
export class SmsModule {}
