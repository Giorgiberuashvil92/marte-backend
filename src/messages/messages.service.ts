import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from '../schemas/message.schema';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Conversation,
  ConversationDocument,
} from '../schemas/conversation.schema';
import { RequestsService } from '../requests/requests.service';

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
    private readonly requestsService: RequestsService,
  ) {}

  async create(dto: MessageCreateDto) {
    console.log(
      `[CHAT] create message requestId=${dto.requestId} userId=${dto.userId} partnerId=${dto.partnerId} sender=${dto.sender} len=${dto.message?.length}`,
    );
    const doc = new this.messageModel({
      ...dto,
      timestamp: Date.now(),
    });
    const saved = await doc.save();

    // Upsert conversation: requestId + partnerId (partnerId = მეორე მხარე – მაღაზია ან იუზერი)
    const lastMessageAt = saved.timestamp;
    const incField = dto.sender === 'user' ? 'partner' : 'user';
    const partnerIdVal = dto.partnerId || '';
    await this.conversationModel.updateOne(
      { requestId: dto.requestId, partnerId: partnerIdVal },
      {
        $setOnInsert: {
          requestId: dto.requestId,
          userId: dto.userId,
          partnerId: partnerIdVal,
        },
        $set: { lastMessage: dto.message, lastMessageAt },
        $inc: { [`unreadCounts.${incField}`]: 1 },
      },
      { upsert: true },
    );

    // Push: მიმღები = მეორე მხარე. user = მოთხოვნის მფლობელი, partner = შეთავაზების ავტორი
    // ორივე მიმართულებაში მიმღების ID ვაწოლებთ getUserIdFromOwnerId-ით, რომ ტოკენი სწორად მოიძებნოს
    try {
      const isFromUser = dto.sender === 'user';
      let targetUserId = isFromUser ? dto.partnerId : dto.userId;
      if (targetUserId) {
        try {
          const mapped = await (
            this.notificationsService as unknown as {
              getUserIdFromOwnerId?(id: string): Promise<string | null>;
            }
          ).getUserIdFromOwnerId?.(String(targetUserId));
          if (mapped) targetUserId = String(mapped);
        } catch {
          // mapping ვერ მოხდა – ვიყენებთ ორიგინალ targetUserId-ს
        }
      }
      if (targetUserId) {
        console.log(
          `[CHAT] push target userId=${targetUserId} (sender=${dto.sender} => notify ${isFromUser ? 'partner' : 'user'})`,
        );
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
              partnerId: dto.partnerId || '',
            },
            sound: 'default',
            badge: 1,
          },
          'message',
        );
        console.log(`[CHAT] push sent ok to ${targetUserId}`);
      } else {
        console.log('[CHAT] push skipped: no targetUserId');
      }
    } catch (pushErr) {
      console.error('[CHAT] push failed (message still saved):', pushErr);
    }

    return saved;
  }

  /** Conversation-ის მიღება requestId + partnerId-ით (partnerId = შემომთავაზებელი). */
  async getConversation(
    requestId: string,
    partnerId: string,
  ): Promise<{ userId: string; partnerId: string } | null> {
    const conv = await this.conversationModel
      .findOne({ requestId, partnerId })
      .lean()
      .exec();
    if (!conv) return null;
    return { userId: conv.userId, partnerId: conv.partnerId };
  }

  /**
   * Conversation-ის მიღება ნებისმიერი მონაწილის id-ით.
   * userId = ვინც შეთავაზებას იღებს (მოთხოვნის მფლობელი), partnerId = ვინც თავაზობს.
   */
  async getConversationByParticipant(
    requestId: string,
    participantId: string,
  ): Promise<{ userId: string; partnerId: string } | null> {
    const conv = await this.conversationModel
      .findOne({
        requestId,
        $or: [{ userId: participantId }, { partnerId: participantId }],
      })
      .lean()
      .exec();
    if (!conv) return null;
    return { userId: conv.userId, partnerId: conv.partnerId };
  }

  async getChatHistory(
    requestId: string,
    partnerId?: string,
  ): Promise<Array<Record<string, unknown> & { sender: 'user' | 'partner' }>> {
    const filter: { requestId: string; partnerId?: string } = { requestId };
    if (partnerId) filter.partnerId = partnerId;
    const list = await this.messageModel
      .find(filter)
      .sort({ timestamp: 1 })
      .lean()
      .exec();
    let requestOwnerId: string | null = null;
    try {
      const request = await this.requestsService.findOne(requestId);
      if (request?.userId) requestOwnerId = String(request.userId);
    } catch {
      // ignore
    }
    return list.map(
      (msg: { userId?: unknown; sender?: string; [k: string]: unknown }) => {
        let sender: 'user' | 'partner';
        if (
          requestOwnerId != null &&
          String(msg.userId) !== String(requestOwnerId)
        ) {
          sender = 'partner';
        } else {
          sender = msg.sender === 'partner' ? 'partner' : 'user';
        }
        return { ...msg, sender };
      },
    );
  }

  async markAsRead(requestId: string, userId: string, partnerId?: string) {
    const filter: {
      requestId: string;
      sender: 'user' | 'partner';
      partnerId?: string;
    } = {
      requestId,
      sender: userId ? 'partner' : 'user',
    };
    if (partnerId) filter.partnerId = partnerId;
    return this.messageModel
      .updateMany({ ...filter, isRead: false }, { isRead: true })
      .exec();
  }

  async getUnreadCount(requestId: string, userId: string, partnerId?: string) {
    const filter: {
      requestId: string;
      sender: 'user' | 'partner';
      partnerId?: string;
      isRead: boolean;
    } = {
      requestId,
      sender: userId ? 'partner' : 'user',
      isRead: false,
    };
    if (partnerId) filter.partnerId = partnerId;
    return this.messageModel.countDocuments(filter).exec();
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
