import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from '../schemas/message.schema';
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
