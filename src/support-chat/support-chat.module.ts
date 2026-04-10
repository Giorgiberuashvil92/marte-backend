import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SupportThread,
  SupportThreadSchema,
} from '../schemas/support-thread.schema';
import {
  SupportMessage,
  SupportMessageSchema,
} from '../schemas/support-message.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupportChatService } from './support-chat.service';
import { SupportChatController } from './support-chat.controller';
import { SupportChatGateway } from './support-chat.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportThread.name, schema: SupportThreadSchema },
      { name: SupportMessage.name, schema: SupportMessageSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [SupportChatController],
  providers: [SupportChatService, SupportChatGateway],
  exports: [SupportChatService, SupportChatGateway],
})
export class SupportChatModule {}
