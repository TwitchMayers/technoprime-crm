import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsService } from '../events/events.service';
import {
  SubscriptionType,
  SubscriptionStatus,
  AccountType,
  SubscriptionPeriod,
  OrderStatus,
  CommunicationChannel,
} from '@prisma/client';
import { CommunicationService } from '../communication/communication.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsService,
    private communication: CommunicationService,
  ) {}

  private normalizeText(value?: string | null) {
    const text = String(value || '').trim();
    return text || null;
  }

  private resolveClientAccountPayload(body: {
    consoleType?: string | null;
    emailLogin?: string | null;
    emailPassword?: string | null;
    accountPassword?: string | null;
    psEmail?: string | null;
    psPassword?: string | null;
  }) {
    return {
      consoleType: this.normalizeText(body.consoleType),
      emailLogin: this.normalizeText(body.emailLogin ?? body.psEmail),
      emailPassword: this.normalizeText(body.emailPassword ?? body.psPassword),
      accountPassword: this.normalizeText(body.accountPassword),
    };
  }

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
    consoleType?: string | null;
    emailLogin?: string | null;
    emailPassword?: string | null;
    accountPassword?: string | null;
    psEmail?: string | null;
    psPassword?: string | null;
  }) {
    const type = body.type as SubscriptionType;
    const accountType = body.accountType || AccountType.PERSONAL;
    const accountPayload = this.resolveClientAccountPayload(body);

    if (accountType === AccountType.PERSONAL) {
      if (!accountPayload.emailLogin || !accountPayload.emailPassword) {
        throw new BadRequestException(
          'Для персональной подписки нужно указать логин и пароль аккаунта',
        );
      }
    }

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
          { status: SubscriptionStatus.EXPIRED, endDate: { gte: new Date() } },
        ],
      },
      orderBy: { endDate: 'desc' },
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
        item => item.product?.category === 'CONSOLE' && item.product?.serialNumber,
      );
      serialNumber = consoleItem?.product?.serialNumber || undefined;
    }

    if (existingSub && accountType === AccountType.PERSONAL) {
      const monthsToAdd = body.durationMonths || this.getMonthsDiff(body.startDate, body.endDate);

      const now = new Date();
      const baseDate = existingSub.endDate > now ? existingSub.endDate : now;

      const newEndDate = new Date(baseDate);
      newEndDate.setMonth(newEndDate.getMonth() + monthsToAdd);

      return this.prisma.$transaction(async tx => {
        await tx.client.update({
          where: { id: body.clientId },
          data: {
            ...(accountPayload.consoleType ? { consoleType: accountPayload.consoleType } : {}),
            ...(accountPayload.emailLogin ? { emailLogin: accountPayload.emailLogin } : {}),
            ...(accountPayload.emailPassword
              ? { emailPassword: accountPayload.emailPassword }
              : {}),
            ...(accountPayload.accountPassword
              ? { accountPassword: accountPayload.accountPassword }
              : {}),
          },
        });

        return tx.subscription.update({
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
      });
    }

    return this.prisma.$transaction(async tx => {
      await tx.client.update({
        where: { id: body.clientId },
        data: {
          ...(accountPayload.consoleType ? { consoleType: accountPayload.consoleType } : {}),
          ...(accountPayload.emailLogin ? { emailLogin: accountPayload.emailLogin } : {}),
          ...(accountPayload.emailPassword ? { emailPassword: accountPayload.emailPassword } : {}),
          ...(accountPayload.accountPassword
            ? { accountPassword: accountPayload.accountPassword }
            : {}),
        },
      });

      return tx.subscription.create({
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
    });
  }

  private getMonthsDiff(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
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
    consoleType: 'PS4' | 'PS5' | 'XBOX_1' | 'XBOX_2';
    startDate: string;
    endDate: string;
    managerId?: number;
    notes?: string;
  }) {
    return this.prisma.$transaction(async tx => {
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

    if (
      !user ||
      (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'MANAGER')
    ) {
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
      message: `Подписка ${subscription.type} удалена`,
    };
  }

  private normalizePhone(input?: string | null) {
    const digits = String(input || '').replace(/\D/g, '');
    if (digits.length === 10) return `7${digits}`;
    if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
    return digits;
  }

  private buildPhoneAliases(input?: string | null) {
    const normalized = this.normalizePhone(input);
    if (!normalized || normalized.length < 10) return [] as string[];
    const last10 = normalized.slice(-10);
    const aliases = new Set<string>([normalized, `+${normalized}`]);
    if (last10.length === 10) {
      aliases.add(last10);
      aliases.add(`7${last10}`);
      aliases.add(`+7${last10}`);
      aliases.add(`8${last10}`);
      aliases.add(`+8${last10}`);
    }
    return Array.from(aliases).filter(Boolean);
  }

  private targetWindow(daysAhead: number) {
    const target = new Date();
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() + daysAhead);

    const end = new Date(target);
    end.setHours(23, 59, 59, 999);

    return { start: target, end };
  }

  private async canSendCustomerReminder(phone?: string | null) {
    const aliases = this.buildPhoneAliases(phone);
    if (!aliases.length) return true;

    const customer = await this.prisma.shopCustomer.findFirst({
      where: {
        phone: { in: aliases },
      },
      select: {
        notifySubscription: true,
      },
      orderBy: { id: 'desc' },
    });

    if (!customer) return true;
    return customer.notifySubscription !== false;
  }

  private async notifyExpiringSubscriptions(daysAhead: number) {
    const { start, end } = this.targetWindow(daysAhead);
    const subs = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: { gte: start, lte: end },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            telegramId: true,
            vkId: true,
            maxId: true,
          },
        },
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
      const dayWord = daysAhead === 1 ? 'завтра' : `через ${daysAhead} дней`;
      const systemInfo =
        s.accountType === AccountType.SHARING_CLIENT && s.clientSlot
          ? ` (Система: ${s.clientSlot.sharingSystem.name})`
          : '';
      const msg = `Подписка ${s.type} для ${s.client?.name || 'клиента'}${systemInfo} истекает ${dayWord} (${s.endDate.toLocaleDateString('ru')})`;

      const managerId = s.managerId || null;
      if (!managerId) {
        continue;
      }
      await this.prisma.notification
        .create({
          data: {
            userId: managerId,
            type: daysAhead === 1 ? 'SUBSCRIPTION_EXPIRING' : 'SUBSCRIPTION_EXPIRING_5D',
            payload: {
              subscriptionId: s.id,
              clientName: s.client?.name,
              systemName: s.clientSlot?.sharingSystem.name || null,
              daysAhead,
              endDate: s.endDate,
            } as any,
          },
        })
        .catch(() => undefined);

      this.events.notifyUser(managerId, 'notification', {
        title: daysAhead === 1 ? 'Подписка истекает завтра' : 'Подписка скоро истекает',
        text: msg,
      });

      const canSend = await this.canSendCustomerReminder(s.client?.phone);
      if (!canSend) continue;

      const customerText =
        daysAhead === 1
          ? `Напоминаем: ваша подписка ${s.type} заканчивается завтра (${s.endDate.toLocaleDateString('ru-RU')}).`
          : `Напоминаем: ваша подписка ${s.type} закончится через 5 дней (${s.endDate.toLocaleDateString('ru-RU')}).`;
      const customerTitle =
        daysAhead === 1 ? 'Подписка заканчивается завтра' : 'Подписка заканчивается через 5 дней';

      const channels: Array<{ channel: CommunicationChannel; target?: string | null }> = [
        { channel: CommunicationChannel.TELEGRAM, target: s.client?.telegramId || null },
        { channel: CommunicationChannel.VK, target: s.client?.vkId || null },
        { channel: CommunicationChannel.MAX, target: s.client?.maxId || null },
      ];

      for (const channel of channels) {
        if (!channel.target) continue;
        await this.communication
          .sendByChannel(channel.channel, channel.target, customerText, [], {
            title: customerTitle,
            buttonText: 'Продлить подписку',
            buttonUrl: 'https://technoprimestore.ru/account',
          })
          .catch(() => undefined);
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async checkExpiring() {
    await this.notifyExpiringSubscriptions(1);
    await this.notifyExpiringSubscriptions(5);
  }

  async getSubscriptionStats() {
    const [totalSubscriptions, activeSubscriptions, sharingSubscriptions, personalSubscriptions] =
      await Promise.all([
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
