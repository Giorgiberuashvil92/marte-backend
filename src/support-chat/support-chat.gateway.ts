import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  SupportChatService,
  SupportChatMessageDto,
} from './support-chat.service';

function roomForUser(userId: string): string {
  return `support:${userId}`;
}

@WebSocketGateway({ namespace: '/support-chat', cors: { origin: '*' } })
export class SupportChatGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(SupportChatGateway.name);

  constructor(private readonly supportChatService: SupportChatService) {}

  emitMessage(userId: string, message: SupportChatMessageDto): void {
    this.server.to(roomForUser(userId)).emit('support:message', message);
  }

  handleConnection(client: Socket): void {
    void this.onConnected(client);
  }

  private async onConnected(client: Socket): Promise<void> {
    const userId =
      (client.handshake.headers['x-user-id'] as string) ||
      (client.handshake.query?.userId as string) ||
      '';
    const trimmed = userId.trim();
    if (!trimmed) {
      this.logger.warn(
        `support-chat disconnect: no userId socket=${client.id}`,
      );
      client.disconnect(true);
      return;
    }
    (client.data as { userId?: string }).userId = trimmed;
    await client.join(roomForUser(trimmed));
    this.logger.log(`support-chat join userId=${trimmed} socket=${client.id}`);
    try {
      const history = await this.supportChatService.listMessagesDto(trimmed);
      client.emit('support:history', history);
    } catch (e) {
      this.logger.error('support:history failed', e);
      client.emit('support:history', []);
    }
  }
}
