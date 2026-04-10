import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SupportThread,
  SupportThreadDocument,
} from '../schemas/support-thread.schema';
import {
  SupportMessage,
  SupportMessageDocument,
} from '../schemas/support-message.schema';
import { NotificationsService } from '../notifications/notifications.service';

export type SupportChatMessageDto = {
  id: string;
  text: string;
  sender: 'user' | 'agent';
  ts: number;
};

function toDto(doc: SupportMessageDocument): SupportChatMessageDto {
  return {
    id: String(doc._id),
    text: doc.text,
    sender: doc.sender,
    ts: doc.timestamp,
  };
}

/**
 * შეტყობინების ტექსტის ლოგი: ნაგულისხმევად dev-ში ჩართულია, production-ში გამორთული.
 * ლოკალური ტესტი prod რეჟიმით: SUPPORT_CHAT_LOG_MESSAGES=1
 * სრულად გამორთვა: SUPPORT_CHAT_LOG_MESSAGES=0
 */
function shouldLogSupportChatBodies(): boolean {
  if (process.env.SUPPORT_CHAT_LOG_MESSAGES === '1') return true;
  if (process.env.SUPPORT_CHAT_LOG_MESSAGES === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

function clipForLog(text: string, max = 600): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

@Injectable()
export class SupportChatService {
  private readonly logger = new Logger(SupportChatService.name);

  constructor(
    @InjectModel(SupportThread.name)
    private readonly threadModel: Model<SupportThreadDocument>,
    @InjectModel(SupportMessage.name)
    private readonly messageModel: Model<SupportMessageDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getOrCreateThread(userId: string): Promise<SupportThreadDocument> {
    let thread = await this.threadModel.findOne({ userId }).exec();
    if (!thread) {
      thread = await this.threadModel.create({
        userId,
        userLastReadAt: 0,
        supportReadCursorBackfilled: true,
      });
      this.logger.log(`support thread created userId=${userId}`);
    }
    return thread;
  }

  /** აგენტის ნაანახი შეტყობინებების რაოდენობა (ბეიჯი აპში). */
  async getUnreadAgentMessageCount(userId: string): Promise<number> {
    const thread = await this.threadModel.findOne({ userId }).exec();
    if (!thread) return 0;

    if (thread.supportReadCursorBackfilled !== true) {
      const last = await this.messageModel
        .findOne({ threadId: thread._id })
        .sort({ timestamp: -1 })
        .select('timestamp')
        .lean()
        .exec();
      const t = last?.timestamp ?? thread.userLastReadAt ?? 0;
      await this.threadModel
        .updateOne(
          { _id: thread._id },
          { $set: { userLastReadAt: t, supportReadCursorBackfilled: true } },
        )
        .exec();
      return 0;
    }

    const lastRead = thread.userLastReadAt ?? 0;
    return this.messageModel
      .countDocuments({
        threadId: thread._id,
        sender: 'agent',
        timestamp: { $gt: lastRead },
      })
      .exec();
  }

  /**
   * მომხმარებელმა გახსნა საუბარი — ყველა არსებული მესიჯი „ნახულად“ მოინიშნება.
   */
  async markThreadReadByUser(userId: string): Promise<void> {
    const thread = await this.getOrCreateThread(userId);
    const last = await this.messageModel
      .findOne({ threadId: thread._id })
      .sort({ timestamp: -1 })
      .select('timestamp')
      .lean()
      .exec();
    const t = last?.timestamp ?? Date.now();
    await this.threadModel
      .updateOne(
        { _id: thread._id },
        { $set: { userLastReadAt: t, supportReadCursorBackfilled: true } },
      )
      .exec();
  }

  async listMessagesDto(userId: string): Promise<SupportChatMessageDto[]> {
    const thread = await this.threadModel.findOne({ userId }).exec();
    if (!thread) return [];
    const list = await this.messageModel
      .find({ threadId: thread._id })
      .sort({ timestamp: 1 })
      .limit(500)
      .lean()
      .exec();
    return list.map((m) => ({
      id: String(m._id),
      text: m.text,
      sender: m.sender,
      ts: m.timestamp,
    }));
  }

  /** ადმინის სია: ბოლო მესიჯი თითო userId (მომხმარებელი ან guest) თრედზე */
  async listThreadsForAdmin(): Promise<
    Array<{
      userId: string;
      lastMessage: string;
      lastAt: number;
      lastSender: 'user' | 'agent';
    }>
  > {
    const agg = await this.messageModel
      .aggregate<{
        _id: string;
        lastMessage: string;
        lastAt: number;
        lastSender: string;
      }>([
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: '$userId',
            lastMessage: { $first: '$text' },
            lastAt: { $first: '$timestamp' },
            lastSender: { $first: '$sender' },
          },
        },
        { $sort: { lastAt: -1 } },
        { $limit: 400 },
      ])
      .exec();
    return agg.map((r) => ({
      userId: r._id,
      lastMessage: r.lastMessage,
      lastAt: r.lastAt,
      lastSender: r.lastSender === 'agent' ? 'agent' : 'user',
    }));
  }

  async createUserMessage(
    userId: string,
    text: string,
  ): Promise<SupportChatMessageDto> {
    const trimmed = text?.trim();
    if (!trimmed) {
      throw new BadRequestException('ცარიელი შეტყობინება');
    }
    const thread = await this.getOrCreateThread(userId);
    const doc = await this.messageModel.create({
      threadId: thread._id as Types.ObjectId,
      userId,
      sender: 'user',
      text: trimmed,
      timestamp: Date.now(),
    });
    const dto = toDto(doc);
    if (shouldLogSupportChatBodies()) {
      this.logger.log(
        `[SUPPORT-CHAT] 📤 USER გაგზავნა | userId=${userId} | msgId=${dto.id} | ტექსტი: ${JSON.stringify(clipForLog(trimmed))}`,
      );
    }
    return dto;
  }

  async createAgentMessage(
    targetUserId: string,
    text: string,
  ): Promise<SupportChatMessageDto> {
    const trimmed = text?.trim();
    if (!trimmed) {
      throw new BadRequestException('ცარიელი შეტყობინება');
    }
    const thread = await this.getOrCreateThread(targetUserId);
    const doc = await this.messageModel.create({
      threadId: thread._id as Types.ObjectId,
      userId: targetUserId,
      sender: 'agent',
      text: trimmed,
      timestamp: Date.now(),
    });

    if (!targetUserId.startsWith('guest:')) {
      try {
        await this.notificationsService.sendPushToUsers(
          [targetUserId],
          {
            title: '💬 საპორტი',
            body: trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed,
            data: {
              type: 'support_chat',
              screen: 'support-chat',
            },
            sound: 'default',
            badge: 1,
          },
          'message',
        );
      } catch (e) {
        this.logger.warn(`support push failed userId=${targetUserId}`, e);
      }
    }

    const dto = toDto(doc);
    if (shouldLogSupportChatBodies()) {
      this.logger.log(
        `[SUPPORT-CHAT] 📥 AGENT პასუხი | targetUserId=${targetUserId} | msgId=${dto.id} | ტექსტი: ${JSON.stringify(clipForLog(trimmed))}`,
      );
    }
    return dto;
  }
}
