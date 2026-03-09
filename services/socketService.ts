import { io, Socket } from 'socket.io-client';
import API_BASE_URL from '@/config/api';

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

interface SocketService {
  connect: (userId: string, partnerId?: string) => void;
  disconnect: () => void;
  joinChat: (requestId: string, userId: string, partnerId?: string) => void;
  /** Backend განსაზღვრავს ვინ წერს join-ის მონაცემებიდან – sender ოფციონალურია და იგნორირდება. */
  sendMessage: (requestId: string, message: string, sender?: 'user' | 'partner') => void;
  onMessage: (callback: (message: ChatMessage) => void) => void;
  onChatHistory: (callback: (history: ChatMessage[]) => void) => void;
  onTypingStart: (callback: (data: any) => void) => void;
  
  onTypingStop: (callback: (data: any) => void) => void;
  onMessageRead: (callback: (data: any) => void) => void;
  startTyping: (requestId: string, sender: 'user' | 'partner') => void;
  stopTyping: (requestId: string, sender: 'user' | 'partner') => void;
  markAsRead: (requestId: string, messageId: string) => void;
}

class SocketServiceClass implements SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private pendingJoins: Array<{ requestId: string; userId: string; partnerId?: string }> = [];
  private pendingMessages: Array<{ requestId: string; message: string }> = [];
  /** Re-join this room on reconnect so message:new keeps working */
  private lastJoinChat: { requestId: string; userId: string; partnerId?: string } | null = null;
  private hadConnection = false;

  connect(userId: string, partnerId?: string) {
    if (this.isConnected) return;

    const wsUrl = API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    
    this.socket = io(`${wsUrl}/chat`, {
      transports: ['websocket', 'polling'],
      query: {
        userId,
        partnerId: partnerId || '',
      },
      extraHeaders: {
        'x-user-id': userId,
        'x-partner-id': partnerId || '',
      },
    });

    this.socket.on('connect', () => {
      console.log('🔌 Chat socket connected:', this.socket?.id);
      this.isConnected = true;
      // Flush pending joins (e.g. join was called before socket was ready)
      this.pendingJoins.forEach(({ requestId, userId, partnerId }) => {
        this.emitJoinChat(requestId, userId, partnerId);
      });
      this.pendingJoins = [];
      // Re-join last room only after a reconnect (so message:new is received again)
      if (this.hadConnection && this.lastJoinChat) {
        this.emitJoinChat(this.lastJoinChat.requestId, this.lastJoinChat.userId, this.lastJoinChat.partnerId);
      }
      this.hadConnection = true;
      // Flush pending messages
      this.pendingMessages.forEach(({ requestId, message }) => {
        this.sendMessage(requestId, message);
      });
      this.pendingMessages = [];
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Chat socket disconnected');
      this.isConnected = false;
      // hadConnection stays true so next connect is treated as reconnect
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Chat socket connection error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.lastJoinChat = null;
      this.hadConnection = false;
    }
  }

  private emitJoinChat(requestId: string, userId: string, partnerId?: string) {
    if (!this.socket || !this.isConnected) return;
    this.lastJoinChat = { requestId, userId, partnerId };
    this.socket.emit('join_chat', { requestId, userId, partnerId });
  }

  joinChat(requestId: string, userId: string, partnerId?: string) {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Socket not connected, queue join chat');
      this.pendingJoins.push({ requestId, userId, partnerId });
      return;
    }
    this.emitJoinChat(requestId, userId, partnerId);
  }

  sendMessage(requestId: string, message: string, _sender?: 'user' | 'partner') {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Socket not connected, queue message');
      this.pendingMessages.push({ requestId, message });
      return;
    }
    this.socket.emit('send_message', { requestId, message });
  }

  onMessage(callback: (message: ChatMessage) => void) {
    if (!this.socket) return;
    
    this.socket.on('message:new', callback);
  }

  onChatHistory(callback: (history: ChatMessage[]) => void) {
    if (!this.socket) return;
    
    this.socket.on('chat:history', callback);
  }

  onTypingStart(callback: (data: any) => void) {
    if (!this.socket) return;
    
    this.socket.on('typing:start', callback);
  }

  onTypingStop(callback: (data: any) => void) {
    if (!this.socket) return;
    
    this.socket.on('typing:stop', callback);
  }

  onMessageRead(callback: (data: any) => void) {
    if (!this.socket) return;
    
    this.socket.on('message:read', callback);
  }

  startTyping(requestId: string, sender: 'user' | 'partner') {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('typing_start', {
      requestId,
      sender,
    });
  }

  stopTyping(requestId: string, sender: 'user' | 'partner') {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('typing_stop', {
      requestId,
      sender,
    });
  }

  markAsRead(requestId: string, messageId: string) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('mark_read', {
      requestId,
      messageId,
    });
  }
}

// Export singleton instance
export const socketService = new SocketServiceClass();
export type { ChatMessage, SocketService };
