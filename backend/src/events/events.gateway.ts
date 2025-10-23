import {
  WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { OnModuleInit } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/] },
})
export class EventsGateway implements OnModuleInit {
  server: Server;

  onModuleInit() {
    // no-op
  }

  handleConnection(client: Socket) {
    // клиент после коннекта должен отправить register { userId }
  }

  @SubscribeMessage('register')
  handleRegister(@MessageBody() data: { userId: number }, @ConnectedSocket() client: Socket) {
    if (data?.userId) {
      client.join(`user:${data.userId}`);
    }
    client.join('queue'); // общая комната для очереди
    client.emit('registered', { ok: true });
  }

  emitToUser(userId: number, event: string, payload: any) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  emitQueueUpdate(payload?: any) {
    this.server?.to('queue').emit('queueUpdated', payload || {});
  }
}