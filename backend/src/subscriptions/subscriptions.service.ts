import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsService } from '../events/events.service';
import { SubscriptionType, SubscriptionStatus, AccountType, SubscriptionPeriod, OrderStatus } from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsService,
  ) {}

  async list(query?: { clientId?: number; status?: string; accountType?: string }) {
    const where: any = {};
    if (query?.clientId) where.clientId = Number(query.clientId);
    if (query?.status) where.status = query.status;
    if (query?.accountType) where.accountType = query.accountType;

    return this.prisma.subscription.findMany({
      where,
      include: {   
        client: {
          include: {
            orders: {
              where: { status: OrderStatus.COMPLETED },
              include: {  
                items: {
                  include: {
                    product: true,
                  },
                },
              },
              orderBy: { date: 'desc' },
              take: 1,
            },
          },
        }, 
        manager: true,
        clientSlot: {
          include: {
            sharingSystem: {
              include: {
                donor: true,
              },
            },
          },
        },
        donorAccount: true,
      },
      orderBy: { endDate: 'asc' },
    });
  }

  async create(body: {
    clientId: number;
    type: string | SubscriptionType;
    startDate: string;
    endDate: string;
    status?: string | SubscriptionStatus;
    managerId?: number;
    durationMonths?: number;
    accountType?: AccountType;
    subscriptionPeriod?: SubscriptionPeriod;
    clientSlotId?: number;
    donorAccountId?: number;
  }) {
    const type = body.type as SubscriptionType;
    const accountType = body.accountType || AccountType.PERSONAL;
    
    if (accountType === AccountType.SHARING_CLIENT) {
      if (!body.clientSlotId) {
        throw new BadRequestException('Для шеринговой подписки необходимо указать clientSlotId');
      }
      
      const clientSlot = await this.prisma.clientSlot.findUnique({
        where: { id: body.clientSlotId },
        include: {
          sharingSystem: {
            include: { donor: true },
          },
        },
      });

      if (!clientSlot) {
        throw new BadRequestException('Указанный слот не найден');
      }

      if (!clientSlot.isActive) {
        throw new BadRequestException('Указанный слот не активен');
      }

      const existingSlotSubscription = await this.prisma.subscription.findFirst({
        where: {
          clientSlotId: body.clientSlotId,
          status: SubscriptionStatus.ACTIVE,
        },
      });

      if (existingSlotSubscription) {
        throw new BadRequestException('Этот слот уже занят другой активной подписки');
      }

      body.startDate = clientSlot.startDate.toISOString();
      body.endDate = clientSlot.endDate.toISOString();
    }

    const existingSub = await this.prisma.subscription.findFirst({
      where: {
        clientId: body.clientId,
        type: type,
        OR: [
          { status: SubscriptionStatus.ACTIVE },
          { status: SubscriptionStatus.EXPIRED, endDate: { gte: new Date() } }
        ]
      },
      orderBy: { endDate: 'desc' }
    });

    const client = await this.prisma.client.findUnique({
      where: { id: body.clientId },
      include: {  
        orders: {
          where: { status: OrderStatus.COMPLETED },
          include: {  
            items: {
              include: {
                product: true,
              },
            },
          },
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    let serialNumber: string | undefined;
    if (client?.orders && client.orders.length > 0 && client.orders[0].items) {
      const consoleItem = client.orders[0].items.find(
        item => item.product?.category === 'CONSOLE' && item.product?.serialNumber
      );
      serialNumber = consoleItem?.product?.serialNumber || undefined;
    }

    if (existingSub && accountType === AccountType.PERSONAL) {
      const monthsToAdd = body.durationMonths || this.getMonthsDiff(body.startDate, body.endDate);
      
      const now = new Date();
      const baseDate = existingSub.endDate > now ? existingSub.endDate : now;
      
      const newEndDate = new Date(baseDate);
      newEndDate.setMonth(newEndDate.getMonth() + monthsToAdd);

      return this.prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          endDate: newEndDate,
          status: SubscriptionStatus.ACTIVE,
          serialNumber: serialNumber || existingSub.serialNumber,
          accountType: accountType,
          subscriptionPeriod: body.subscriptionPeriod || existingSub.subscriptionPeriod,
        },
        include: {  
          client: true,
          clientSlot: {
            include: {
              sharingSystem: {
                include: { donor: true },
              },
            },
          },
          donorAccount: true,
        },
      });
    }

    return this.prisma.subscription.create({
      data: {
        clientId: body.clientId,
        type: type,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        status: (body.status as SubscriptionStatus) || SubscriptionStatus.ACTIVE,
        managerId: body.managerId || undefined,
        serialNumber: serialNumber,
        accountType: accountType,
        subscriptionPeriod: body.subscriptionPeriod || SubscriptionPeriod.MONTH,
        clientSlotId: body.clientSlotId || undefined,
        donorAccountId: body.donorAccountId || undefined,
      },
      include: {  
        client: true,
        clientSlot: {
          include: {
            sharingSystem: {
              include: { donor: true },
            },
          },
        },
        donorAccount: true,
      },
    });
  }

  private getMonthsDiff(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return Math.max(1, months);
  }

  async renew(clientId: number, type: SubscriptionType, months: number, managerId?: number) {
    return this.create({
      clientId,
      type,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: SubscriptionStatus.ACTIVE,
      managerId,
      durationMonths: months,
    });
  }

  async createSharingSubscription(data: {
    clientId: number;
    type: SubscriptionType;
    sharingSystemId: number;
    consoleType: 'PS4' | 'PS5';
    startDate: string;
    endDate: string;
    managerId?: number;
    notes?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const clientSlot = await tx.clientSlot.create({
        data: {
          sharingSystemId: data.sharingSystemId,
          clientId: data.clientId,
          consoleType: data.consoleType,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          isActive: true,
          notes: data.notes,
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          clientId: data.clientId,
          type: data.type,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          status: SubscriptionStatus.ACTIVE,
          managerId: data.managerId,
          accountType: AccountType.SHARING_CLIENT,
          subscriptionPeriod: SubscriptionPeriod.YEAR,
          clientSlotId: clientSlot.id,
        },
        include: {  
          client: true,
          clientSlot: {
            include: {
              sharingSystem: {
                include: { donor: true },
              },
            },
          },
        },
      });

      return subscription;
    });
  }

  async getSubscriptionsBySharingSystem(sharingSystemId: number) {
    return this.prisma.subscription.findMany({
      where: {
        clientSlot: {
          sharingSystemId: sharingSystemId,
        },
        status: SubscriptionStatus.ACTIVE,
      },
      include: {  
        client: true,
        clientSlot: {
          include: {
            sharingSystem: {
              include: { donor: true },
            },
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async getSubscriptionDaysLeft(subscriptionId: number): Promise<number> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { endDate: true },
    });

    if (!subscription) {
      throw new NotFoundException('Подписка не найдена');
    }

    const now = new Date();
    const endDate = new Date(subscription.endDate);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }

  async delete(id: number, userId: number) {
    const user = await this.prisma.employee.findUnique({
      where: { id: userId },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'MANAGER')) {
      throw new Error('Недостаточно прав для удаления подписки');
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {   
        client: true,
        clientSlot: true,
      },
    });

    if (!subscription) {
      throw new Error('Подписка не найдена');
    }

    if (subscription.clientSlotId && subscription.clientSlot) {
      await this.prisma.clientSlot.update({
        where: { id: subscription.clientSlotId },
        data: { isActive: false },
      });
    }

    await this.prisma.subscription.delete({
      where: { id },
    });

    console.log(`🗑️ Subscription ${id} deleted by user ${userId}`);

    return { 
      success: true, 
      message: `Подписка ${subscription.type} удалена`
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async checkExpiring() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setHours(23, 59, 59, 999);

    const subs = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: { gte: tomorrow, lte: endOfTomorrow },
      },
      include: {   
        client: true,
        clientSlot: {
          include: {
            sharingSystem: {
              include: { donor: true },
            },
          },
        },
      },
    });

    for (const s of subs) {
      const systemInfo = s.accountType === AccountType.SHARING_CLIENT && s.clientSlot 
        ? ` (Система: ${s.clientSlot.sharingSystem.name})`
        : '';

      const msg = `Подписка ${s.type} для ${s.client?.name || 'клиента'}${systemInfo} истекает завтра (${s.endDate.toLocaleDateString('ru')})`;
      
      try {
        await this.prisma.notification.create({
          data: {
            userId: s.managerId || 1,
            type: 'SUBSCRIPTION_EXPIRING',
            payload: { 
              subscriptionId: s.id, 
              clientName: s.client?.name,
              systemName: s.clientSlot?.sharingSystem.name 
            } as any,
          },
        });
        this.events.notifyUser(s.managerId || 1, 'notification', { 
          title: 'Подписка истекает', 
          text: msg 
        });
      } catch {}
    }
  }

  async getSubscriptionStats() {
    const [totalSubscriptions, activeSubscriptions, sharingSubscriptions, personalSubscriptions] = await Promise.all([
      this.prisma.subscription.count(),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { accountType: AccountType.SHARING_CLIENT } }),
      this.prisma.subscription.count({ where: { accountType: AccountType.PERSONAL } }),
    ]);

    const expiringSoon = await this.prisma.subscription.count({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: {
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
    });

    return {
      totalSubscriptions,
      activeSubscriptions,
      sharingSubscriptions,
      personalSubscriptions,
      expiringSoon,
    };
  }
}