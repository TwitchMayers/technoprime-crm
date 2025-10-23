import { Injectable } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

@Injectable()
export class EventsService {
  constructor(private gw: EventsGateway) {}

  notifyUser(userId: number, type: string, payload: any) {
    this.gw.emitToUser(userId, 'notification', { type, payload, ts: Date.now() });
  }

  queueUpdated() {
    this.gw.emitQueueUpdate({});
  }
}