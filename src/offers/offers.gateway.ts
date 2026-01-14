import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: '/offers', cors: { origin: '*' } })
export class OffersGateway {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(OffersGateway.name);

  handleConnection(client: Socket) {
    const userId = (client.handshake.headers['x-user-id'] as string) || 'anon';
    this.logger.log(`offers socket connected: ${client.id} userId=${userId}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`offers socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_request')
  onJoinRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { requestId: string },
  ) {
    if (!data?.requestId) return;
    const room = `request:${data.requestId}`;
    client.join(room);
    this.logger.log(`client ${client.id} joined ${room}`);
  }

  // Server-side broadcast helpers
  emitOfferNew(requestId: string, payload: any) {
    const room = `request:${requestId}`;
    this.server.to(room).emit('offer:new', payload);
  }

  emitOfferUpdate(requestId: string, payload: any) {
    const room = `request:${requestId}`;
    this.server.to(room).emit('offer:update', payload);
  }
}
