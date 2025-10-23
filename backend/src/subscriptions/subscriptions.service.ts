import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.subscription.findMany({ include: { client: true }, orderBy: { endDate: 'asc' } });
  }

  create(data: any) {
    return this.prisma.subscription.create({ data });
  }

  async renew(clientId: number, type: 'PS_PLUS'|'GAME_PASS'|'EA_PLAY', months: number, managerId?: number) {
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + months);
    const s = await this.prisma.subscription.create({
      data: { clientId, type, startDate: start, endDate: end, status: 'ACTIVE', managerId: managerId ?? null },
    });

    // уведомление владельцу об успешном продлении
    await this.prisma.notification.create({
      data: { userId: 1, type: 'SUB_RENEW', payload: { clientId, type, months } },
    });
    return s;
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async remindExpiring() {
    const days = Number(process.env.SUBSCRIPTION_REMIND_DAYS || 7);
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + days);

    const subs = await this.prisma.subscription.findMany({
      where: { endDate: { gte: from, lte: to }, status: 'ACTIVE' },
      include: { client: true },
    });

    for (const s of subs) {
      await this.prisma.task.create({
        data: {
          title: `Продление подписки (${s.type}) — ${s.client.name}`,
          type: 'SUBSCRIPTION_RENEWAL',
          assignedToId: 1,
          clientId: s.clientId,
          dueDate: s.endDate,
          status: 'NEW',
          comment: 'Связаться и предложить продление',
        },
      });
    }
    this.logger.log(`Created ${subs.length} renewal tasks`);
  }
}