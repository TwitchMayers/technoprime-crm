import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  @Get()
  list(@Query('userId') userId?: string, @Query('unread') unread?: string) {
    const uid = Number(userId) || 1;
    const flag = unread === 'true';
    return this.svc.list(uid, flag);
  }

  @Patch(':id/read')
  read(@Param('id') id: string) {
    return this.svc.markRead(Number(id));
  }
}