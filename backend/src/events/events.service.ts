import { Injectable } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

@Injectable()
export class EventsService {
  constructor(private gateway: EventsGateway) {}

  notifyUser(userId: number, event: string, data: any) {
    this.gateway.server.emit(`user:${userId}:${event}`, data);
  }

  broadcast(event: string, data: any) {
    this.gateway.server.emit(event, data);
  }

  queueUpdated() {
    this.gateway.server.emit('queueUpdated', { timestamp: Date.now() });
  }
}