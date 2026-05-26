import { Injectable } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

@Injectable()
export class EventsService {
  constructor(private gateway: EventsGateway) {}

  notifyUser(userId: number, event: string, data: any) {
    this.gateway.sendToUser(userId, event, data);
  }

  broadcast(event: string, data: any) {
    this.gateway.sendToAll(event, data);
  }

  queueUpdated() {
    this.gateway.sendToAll('queueUpdated', { timestamp: Date.now() });
  }
}
