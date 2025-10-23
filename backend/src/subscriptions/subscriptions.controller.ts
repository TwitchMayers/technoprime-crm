import { Body, Controller, Get, Post } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private svc: SubscriptionsService) {}

  @Get()
  list() { return this.svc.list(); }

  @Post()
  create(@Body() body: any) { return this.svc.create(body); }

  @Post('renew')
  renew(@Body() body: { clientId: number; type: 'PS_PLUS'|'GAME_PASS'|'EA_PLAY'; months: number; managerId?: number }) {
    return this.svc.renew(body.clientId, body.type, body.months, body.managerId);
  }
}