import API_BASE_URL from '@/config/api';

export interface ChatMessage {
  id: string;
  requestId: string;
  userId: string;
  partnerId: string;
  sender: 'user' | 'partner';
  message: string;
  timestamp: number;
  isRead: boolean;
}

export interface MessageCreateDto {
  requestId: string;
  userId: string;
  partnerId: string;
  sender: 'user' | 'partner';
  message: string;
}

export interface RecentChat {
  _id: string;
  requestId: string;
  userId: string;
  partnerId: string;
  lastMessage?: string;
  lastMessageAt?: number;
  unreadCounts: { user: number; partner: number };
}

class MessagesApiService {
  private baseUrl = `${API_BASE_URL}/messages`;

  async createMessage(messageData: MessageCreateDto): Promise<ChatMessage> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  }

  async getChatHistory(requestId: string, partnerId?: string): Promise<ChatMessage[]> {
    try {
      const params = partnerId ? `?partnerId=${encodeURIComponent(partnerId)}` : '';
      const response = await fetch(`${this.baseUrl}/chat/${requestId}${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching chat history:', error);
      throw error;
    }
  }

  async getRecentChats(userId?: string, partnerId?: string): Promise<RecentChat[]> {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (partnerId) params.append('partnerId', partnerId);

      const response = await fetch(`${this.baseUrl}/recent?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching recent chats:', error);
      throw error;
    }
  }

  async getUnreadCount(requestId: string, userId?: string, partnerId?: string): Promise<number> {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (partnerId) params.append('partnerId', partnerId);

      const response = await fetch(`${this.baseUrl}/unread/${requestId}?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.count || 0;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  }

  async markAsRead(requestId: string, userId?: string, partnerId?: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/read/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, partnerId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const messagesApi = new MessagesApiService();
