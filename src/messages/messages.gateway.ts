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

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class MessagesGateway {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(MessagesGateway.name);

  constructor(private readonly messagesService: MessagesService) {}

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

    const room = `chat:${data.requestId}`;
    client.join(room);

    // Store user info in socket data
    client.data = {
      ...client.data,
      requestId: data.requestId,
      userId: data.userId,
      partnerId: data.partnerId,
    };

    try {
      // Load chat history and send to client
      const chatHistory = await this.messagesService.getChatHistory(
        data.requestId,
      );
      client.emit('chat:history', chatHistory);
    } catch (error) {
      this.logger.error('Error loading chat history:', error);
    }

    this.logger.log(
      `client ${client.id} joined chat room ${room} for request ${data.requestId}`,
    );
  }

  @SubscribeMessage('send_message')
  async onSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { requestId: string; message: string; sender: 'user' | 'partner' },
  ) {
    if (!data?.requestId || !data?.message) return;

    const room = `chat:${data.requestId}`;

    try {
      // Save message to database
      const savedMessage = await this.messagesService.create({
        requestId: data.requestId,
        userId: client.data.userId as string,
        partnerId: (client.data.partnerId as string) || undefined,
        sender: data.sender,
        message: data.message,
      });

      // Create message object for broadcast
      const message: ChatMessage = {
        id: (savedMessage._id as any).toString(),
        requestId: data.requestId,
        userId: client.data.userId as string,
        partnerId: client.data.partnerId as string,
        sender: data.sender,
        message: data.message,
        timestamp: savedMessage.timestamp,
        isRead: false,
      };

      // Broadcast message to all clients in the room
      this.server.to(room).emit('message:new', message);
      // Also notify recent list updates (optional event)
      // fire and forget
      void this.server.to(room).emit('conversation:updated', {
        requestId: data.requestId,
        lastMessage: data.message,
        lastMessageAt: message.timestamp,
      });

      this.logger.log(
        `Message saved and broadcasted in room ${room}: ${data.message.substring(0, 50)}...`,
      );
    } catch (error) {
      this.logger.error('Error saving message to database:', error);

      // Still broadcast the message even if database save fails
      const message: ChatMessage = {
        id: Date.now().toString(),
        requestId: data.requestId,
        userId: client.data.userId as string,
        partnerId: client.data.partnerId as string,
        sender: data.sender,
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

    const room = `chat:${data.requestId}`;
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

    const room = `chat:${data.requestId}`;
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

    const room = `chat:${data.requestId}`;
    client.to(room).emit('message:read', {
      messageId: data.messageId,
      readBy: (client.data.userId || client.data.partnerId) as string,
    });
  }

  // Helper method to emit new message to specific room
  emitMessageNew(requestId: string, message: ChatMessage) {
    const room = `chat:${requestId}`;
    this.server.to(room).emit('message:new', message);
  }

  // Helper method to emit typing indicator
  emitTypingIndicator(
    requestId: string,
    sender: 'user' | 'partner',
    userId: string,
    partnerId?: string,
  ) {
    const room = `chat:${requestId}`;
    this.server.to(room).emit('typing:start', {
      sender,
      userId,
      partnerId,
    });
  }
}
