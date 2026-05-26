import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  @Get()
  list(@Req() req: any, @Query('unread') unread?: string) {
    const uid = Number(req?.user?.id);
    if (!uid) {
      throw new UnauthorizedException('Unauthorized');
    }
    const flag = unread === 'true';
    return this.svc.list(uid, flag);
  }

  @Patch(':id/read')
  read(@Param('id') id: string, @Req() req: any) {
    const uid = Number(req?.user?.id);
    if (!uid) {
      throw new UnauthorizedException('Unauthorized');
    }
    return this.svc.markRead(Number(id), uid);
  }

  @Get('push/public-key')
  publicKey() {
    return this.svc.getWebPushPublicKey();
  }

  @Post('push/subscriptions')
  @HttpCode(200)
  subscribe(@Req() req: any, @Body() body: any) {
    const uid = Number(req?.user?.id);
    if (!uid) {
      throw new UnauthorizedException('Unauthorized');
    }
    return this.svc.upsertPushSubscription(uid, body);
  }

  @Delete('push/subscriptions')
  @HttpCode(200)
  unsubscribe(@Req() req: any, @Body() body?: any) {
    const uid = Number(req?.user?.id);
    if (!uid) {
      throw new UnauthorizedException('Unauthorized');
    }
    return this.svc.removePushSubscription(uid, body?.endpoint);
  }
}
