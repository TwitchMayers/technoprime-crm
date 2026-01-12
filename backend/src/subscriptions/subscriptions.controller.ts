import { Controller, Get, Post, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  list(@Query() query: any) {
    return this.subscriptionsService.list({
      clientId: query.clientId ? Number(query.clientId) : undefined,
      status: query.status,
      accountType: query.accountType,
    });
  }

  @Post()
  create(@Body() body: any, @Req() req: any) {
    const managerId = req?.user?.id;
    return this.subscriptionsService.create({
      ...body,
      managerId,
    });
  }

  @Post('sharing')
  createSharing(@Body() body: any, @Req() req: any) {
    const managerId = req?.user?.id;
    return this.subscriptionsService.createSharingSubscription({
      ...body,
      managerId,
    });
  }

  @Post('renew')
  renew(@Body() body: any, @Req() req: any) {
    const managerId = req?.user?.id;
    return this.subscriptionsService.renew(
      Number(body.clientId),
      body.type,
      Number(body.months || 1),
      managerId,
    );
  }

  @Get('sharing-system/:sharingSystemId')
  getBySharingSystem(@Param('sharingSystemId') sharingSystemId: string) {
    return this.subscriptionsService.getSubscriptionsBySharingSystem(Number(sharingSystemId));
  }

  @Get('stats')
  getStats() {
    return this.subscriptionsService.getSubscriptionStats();
  }

  @Get(':id/days-left')
  getDaysLeft(@Param('id') id: string) {
    return this.subscriptionsService.getSubscriptionDaysLeft(Number(id));
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    const userId = req?.user?.id || 1;
    return this.subscriptionsService.delete(Number(id), userId);
  }
}