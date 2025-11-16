import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from '../schemas/message.schema';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Conversation,
  ConversationDocument,
} from '../schemas/conversation.schema';

export type MessageCreateDto = {
  requestId: string;
  userId: string;
  partnerId?: string;
  sender: 'user' | 'partner';
  message: string;
};

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: MessageCreateDto) {
    const doc = new this.messageModel({
      ...dto,
      timestamp: Date.now(),
    });
    const saved = await doc.save();

    // Upsert conversation snapshot
    const lastMessageAt = saved.timestamp;
    const incField = dto.sender === 'user' ? 'partner' : 'user';
    await this.conversationModel.updateOne(
      { requestId: dto.requestId },
      {
        $setOnInsert: {
          requestId: dto.requestId,
          userId: dto.userId,
          partnerId: dto.partnerId || '',
        },
        $set: { lastMessage: dto.message, lastMessageAt },
        $inc: { [`unreadCounts.${incField}`]: 1 },
      },
      { upsert: true },
    );

    // Push notify receiver
    try {
      const isFromUser = dto.sender === 'user';
      let targetUserId = isFromUser ? dto.partnerId : dto.userId;
      if (isFromUser && targetUserId) {
        try {
          const mapped = await (
            this.notificationsService as any
          )?.getUserIdFromOwnerId?.(String(targetUserId));
          if (mapped) targetUserId = String(mapped);
        } catch {}
      }
      if (targetUserId) {
        await this.notificationsService.sendPushToTargets(
          [{ userId: String(targetUserId) }],
          {
            title: '💬 ახალი მესიჯი',
            body:
              dto.message.length > 120
                ? dto.message.slice(0, 117) + '…'
                : dto.message,
            data: {
              type: 'chat_message',
              screen: 'Chat',
              chatId: dto.requestId,
              requestId: dto.requestId,
            },
            sound: 'default',
            badge: 1,
          },
          'message',
        );
      }
    } catch (e) {
      // do not block message creation on push failure
    }

    return saved;
  }

  async getChatHistory(requestId: string) {
    return this.messageModel.find({ requestId }).sort({ timestamp: 1 }).exec();
  }

  async markAsRead(requestId: string, userId: string) {
    return this.messageModel
      .updateMany(
        {
          requestId,
          sender: userId ? 'partner' : 'user',
          isRead: false,
        },
        { isRead: true },
      )
      .exec();
  }

  async getUnreadCount(requestId: string, userId: string) {
    const count = await this.messageModel
      .countDocuments({
        requestId,
        sender: userId ? 'partner' : 'user', // Count messages from the other party
        isRead: false,
      })
      .exec();
    return count;
  }

  async getRecentChats(userId: string, partnerId?: string) {
    const filter: Partial<Pick<Conversation, 'userId' | 'partnerId'>> = {};
    if (userId) filter.userId = userId;
    if (partnerId) filter.partnerId = partnerId;

    return this.conversationModel
      .find(filter)
      .sort({ lastMessageAt: -1 })
      .lean();
  }
}
