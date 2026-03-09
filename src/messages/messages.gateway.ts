/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { RequestsService } from '../requests/requests.service';

interface ChatMessage {
  id: string;
  requestId: string;
  userId: string;
  partnerId: string;
  sender: 'user' | 'partner';
  message: string;
  timestamp: number;
  isRead: boolean;
}

/** One room per conversation so both sides receive message:new */
function chatRoom(
  requestId: string,
  userId: string,
  partnerId: string,
): string {
  const a = String(userId || '').trim();
  const b = String(partnerId || '').trim();
  const pair = [a, b].sort();
  return `chat:${requestId}:${pair[0]}:${pair[1]}`;
}

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class MessagesGateway {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly requestsService: RequestsService,
  ) {}

  handleConnection(client: Socket) {
    const userId = (client.handshake.headers['x-user-id'] as string) || 'anon';
    const partnerId =
      (client.handshake.headers['x-partner-id'] as string) || null;
    this.logger.log(
      `chat socket connected: ${client.id} userId=${userId} partnerId=${partnerId}`,
    );

    // Store user info in socket data
    void (client.data = {
      userId,
      partnerId,
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`chat socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_chat')
  async onJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { requestId: string; userId: string; partnerId?: string },
  ) {
    if (!data?.requestId) return;

    const userId = data.userId || '';
    const partnerId = data.partnerId || '';
    const room = chatRoom(data.requestId, userId, partnerId);
    await client.join(room);

    client.data = {
      ...client.data,
      requestId: data.requestId,
      userId: data.userId,
      partnerId: data.partnerId,
    };

    this.logger.log(
      `[CHAT] join_chat client=${client.id} room=${room} userId=${data.userId} partnerId=${partnerId}`,
    );

    try {
      const chatHistory = await this.messagesService.getChatHistory(
        data.requestId,
        partnerId || undefined,
      );
      client.emit('chat:history', chatHistory);
      this.logger.log(
        `[CHAT] chat:history sent to ${client.id} messages=${chatHistory?.length ?? 0}`,
      );
    } catch (error) {
      this.logger.error('Error loading chat history:', error);
    }
  }

  @SubscribeMessage('send_message')
  async onSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { requestId: string; message: string; sender?: 'user' | 'partner' },
  ) {
    if (!data?.requestId || !data?.message) return;

    const senderId = (client.data.userId as string) || '';
    const otherUserId = (client.data.partnerId as string) || '';
    const room = chatRoom(data.requestId, senderId, otherUserId);

    this.logger.log(
      `[CHAT] send_message senderId=${senderId} otherUserId=${otherUserId} text=${data.message.substring(0, 30)}...`,
    );

    // ორი მონაწილე: requestOwnerId = ვინც შეთავაზებას იღებს, offererId = ვინც თავაზობს. sender ყოველთვის დერივირდება (არ ვეყრდნობით client.sender-ს).
    let requestOwnerId: string;
    let offererId: string;

    const conv = await this.messagesService.getConversationByParticipant(
      data.requestId,
      senderId,
    );
    if (conv) {
      requestOwnerId = conv.userId;
      offererId = conv.partnerId;
      this.logger.log(
        `[CHAT] from conversation: requestOwnerId=${requestOwnerId} offererId=${offererId}`,
      );
    } else {
      try {
        const request = await this.requestsService.findOne(data.requestId);
        if (request?.userId) {
          requestOwnerId = String(request.userId);
          offererId = requestOwnerId === senderId ? otherUserId : senderId;
          this.logger.log(
            `[CHAT] from request (no conv): requestOwnerId=${requestOwnerId} offererId=${offererId}`,
          );
        } else {
          requestOwnerId = otherUserId || senderId;
          offererId = senderId === requestOwnerId ? otherUserId : senderId;
          this.logger.log(
            `[CHAT] no conv/request – from join: requestOwnerId=${requestOwnerId} offererId=${offererId}`,
          );
        }
      } catch (err) {
        this.logger.warn(`[CHAT] request lookup failed`, err);
        requestOwnerId = otherUserId || senderId;
        offererId = senderId === requestOwnerId ? otherUserId : senderId;
      }
    }

    const userIdSave = requestOwnerId;
    const partnerIdSave = offererId;
    const senderSave: 'user' | 'partner' =
      senderId === requestOwnerId ? 'user' : 'partner';

    try {
      const savedMessage = await this.messagesService.create({
        requestId: data.requestId,
        userId: userIdSave,
        partnerId: partnerIdSave || undefined,
        sender: senderSave,
        message: data.message,
      });

      const message: ChatMessage = {
        id: (savedMessage._id as any).toString(),
        requestId: data.requestId,
        userId: userIdSave,
        partnerId: partnerIdSave,
        sender: senderSave,
        message: data.message,
        timestamp: savedMessage.timestamp,
        isRead: false,
      };

      this.server.to(room).emit('message:new', message);
      void this.server.to(room).emit('conversation:updated', {
        requestId: data.requestId,
        lastMessage: data.message,
        lastMessageAt: message.timestamp,
      });

      this.logger.log(
        `[CHAT] message saved & broadcast room=${room} sender=${senderSave} msgId=${(savedMessage._id as any)?.toString?.()}`,
      );
    } catch (error) {
      this.logger.error('[CHAT] Error saving message to database:', error);

      const message: ChatMessage = {
        id: Date.now().toString(),
        requestId: data.requestId,
        userId: userIdSave,
        partnerId: partnerIdSave,
        sender: senderSave,
        message: data.message,
        timestamp: Date.now(),
        isRead: false,
      };

      this.server.to(room).emit('message:new', message);
    }
  }

  @SubscribeMessage('typing_start')
  onTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { requestId: string; sender: 'user' | 'partner' },
  ) {
    if (!data?.requestId) return;

    const userId = (client.data.userId as string) || '';
    const partnerId = (client.data.partnerId as string) || '';
    const room = chatRoom(data.requestId, userId, partnerId);
    client.to(room).emit('typing:start', {
      sender: data.sender,
      userId: client.data.userId as string,
      partnerId: client.data.partnerId as string,
    });
  }

  @SubscribeMessage('typing_stop')
  onTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { requestId: string; sender: 'user' | 'partner' },
  ) {
    if (!data?.requestId) return;

    const userId = (client.data.userId as string) || '';
    const partnerId = (client.data.partnerId as string) || '';
    const room = chatRoom(data.requestId, userId, partnerId);
    client.to(room).emit('typing:stop', {
      sender: data.sender,
      userId: client.data.userId as string,
      partnerId: client.data.partnerId as string,
    });
  }

  @SubscribeMessage('mark_read')
  onMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { requestId: string; messageId: string },
  ) {
    if (!data?.requestId || !data?.messageId) return;

    const userId = (client.data.userId as string) || '';
    const partnerId = (client.data.partnerId as string) || '';
    const room = chatRoom(data.requestId, userId, partnerId);
    client.to(room).emit('message:read', {
      messageId: data.messageId,
      readBy: (client.data.userId || client.data.partnerId) as string,
    });
  }

  emitMessageNew(requestId: string, partnerId: string, message: ChatMessage) {
    const userId = message.userId || '';
    const room = chatRoom(requestId, userId, partnerId || '');
    this.server.to(room).emit('message:new', message);
  }

  emitTypingIndicator(
    requestId: string,
    partnerId: string,
    sender: 'user' | 'partner',
    userId: string,
  ) {
    const room = chatRoom(requestId, userId, partnerId || '');
    this.server.to(room).emit('typing:start', {
      sender,
      userId,
      partnerId,
    });
  }
}
