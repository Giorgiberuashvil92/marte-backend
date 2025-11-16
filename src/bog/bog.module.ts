import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BOGController } from './bog.controller';
import { BOGPaymentService } from './bog-payment.service';
import { BOGOAuthService } from './bog-oauth.service';

@Module({
  imports: [ConfigModule],
  controllers: [BOGController],
  providers: [BOGPaymentService, BOGOAuthService],
  exports: [BOGPaymentService, BOGOAuthService],
})
export class BOGModule {}
