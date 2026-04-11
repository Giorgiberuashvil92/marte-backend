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
import { User, UserDocument } from '../schemas/user.schema';
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

function displayNameForThreadUser(
  userId: string,
  u: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    id?: string;
  } | null,
): string {
  if (!u) {
    if (userId.startsWith('guest:')) {
      return `სტუმარი (${userId.slice('guest:'.length)})`;
    }
    return userId;
  }
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (u.phone?.trim()) return u.phone.trim();
  if (u.email?.trim()) return u.email.trim();
  return String(u.id || userId);
}

@Injectable()
export class SupportChatService {
  private readonly logger = new Logger(SupportChatService.name);

  constructor(
    @InjectModel(SupportThread.name)
    private readonly threadModel: Model<SupportThreadDocument>,
    @InjectModel(SupportMessage.name)
    private readonly messageModel: Model<SupportMessageDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
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

  /**
   * ადმინმა გახსნა თრედი / ჩატვირთა მესიჯების სია — agentLastReadAt იწევა ბოლო მესიჯის ts-მდე.
   */
  async markThreadReadByAgent(userId: string): Promise<void> {
    const trimmed = userId.trim();
    if (!trimmed) return;
    const thread = await this.threadModel.findOne({ userId: trimmed }).exec();
    if (!thread) return;
    const last = await this.messageModel
      .findOne({ threadId: thread._id })
      .sort({ timestamp: -1 })
      .select('timestamp')
      .lean()
      .exec();
    const t = last?.timestamp ?? Date.now();
    const prev = thread.agentLastReadAt ?? 0;
    const next = Math.max(prev, t);
    await this.threadModel
      .updateOne({ _id: thread._id }, { $set: { agentLastReadAt: next } })
      .exec();
  }

  /** ადმინის სია: ბოლო მესიჯი თითო userId (მომხმარებელი ან guest) თრედზე + სახელი users-იდან */
  async listThreadsForAdmin(): Promise<
    Array<{
      userId: string;
      userDisplayName: string;
      lastMessage: string;
      lastAt: number;
      lastSender: 'user' | 'agent';
      /** true: ბოლო იუზერის მესიჯი ჯერ არ „ნახილია“ ადმინისთვის (წითელი / მოგწერეს) */
      awaitingAgentReply: boolean;
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

    const userIds = [
      ...new Set(
        agg
          .map((r) => String(r._id ?? '').trim())
          .filter((id) => id.length > 0),
      ),
    ];
    const users = await this.userModel
      .find({ id: { $in: userIds } })
      .select('id phone firstName lastName email')
      .lean()
      .exec();
    const byId = new Map<string, (typeof users)[0]>();
    for (const doc of users) {
      const id = String((doc as { id?: string }).id ?? '').trim();
      if (id) byId.set(id, doc);
    }

    const threadDocs = await this.threadModel
      .find({ userId: { $in: userIds } })
      .select('userId agentLastReadAt')
      .lean()
      .exec();
    const agentReadAt = new Map<string, number>();
    for (const t of threadDocs) {
      const uid = String(t.userId ?? '').trim();
      const ar = Number((t as { agentLastReadAt?: number }).agentLastReadAt);
      agentReadAt.set(uid, Number.isFinite(ar) ? ar : 0);
    }

    return agg.map((r) => {
      const userId = String(r._id ?? '').trim();
      const doc = byId.get(userId) ?? null;
      const lastSender: 'user' | 'agent' =
        r.lastSender === 'agent' ? 'agent' : 'user';
      const lastAt = r.lastAt;
      const agentSeen = agentReadAt.get(userId) ?? 0;
      const awaitingAgentReply =
        lastSender === 'user' && lastAt > agentSeen;
      return {
        userId,
        userDisplayName: displayNameForThreadUser(userId, doc),
        lastMessage: r.lastMessage,
        lastAt,
        lastSender,
        awaitingAgentReply,
      };
    });
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
    await this.markThreadReadByAgent(targetUserId);
    return dto;
  }
}
