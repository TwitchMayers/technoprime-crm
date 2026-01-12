import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async list(query?: { q?: string; limit?: string; page?: string }) {
    const page = Number(query?.page) || 1;
    const limit = Math.min(Number(query?.limit) || 50, 200);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query?.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q, mode: 'insensitive' } },
        { address: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        include: {
          // ✅ АКТИВНАЯ ПОДПИСКА
          subscriptions: {
            where: { status: 'ACTIVE' as any },
            include: {
              clientSlot: {
                include: {
                  sharingSystem: {
                    include: { donor: true },
                  },
                },
              },
              donorAccount: true,
            },
            orderBy: { endDate: 'desc' },
            take: 1,
          },
          // ✅ ИСТОРИЯ ЗАВЕРШЁННЫХ ЗАКАЗОВ (сокращённая версия для списка)
          orders: {
            where: { status: OrderStatus.COMPLETED },
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      serialNumber: true,
                      category: true,
                      price: true,
                    },
                  },
                },
              },
              createdBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
              manager: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { date: 'desc' },
            take: 100,
          },
        },
        orderBy: { id: 'desc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };
  }

  async create(data: {
    name: string;
    phone: string;
    city?: string;
    address?: string;
    consoleType?: string;
    emailLogin?: string;
    emailPassword?: string;
    accountPassword?: string;
  }) {
    return this.prisma.client.create({
      data: {
        name: data.name,
        phone: data.phone,
        city: data.city,
        address: data.address,
        consoleType: data.consoleType,
        emailLogin: data.emailLogin,
        emailPassword: data.emailPassword,
        accountPassword: data.accountPassword,
      },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' as any },
          include: {
            clientSlot: {
              include: {
                sharingSystem: {
                  include: { donor: true },
                },
              },
            },
            donorAccount: true,
          },
          take: 1,
        },
        orders: {
          where: { status: OrderStatus.COMPLETED },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    serialNumber: true,
                    category: true,
                    price: true,
                  },
                },
              },
            },
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
            manager: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { date: 'desc' },
          take: 100,
        },
      } as any,
    });
  }

  async update(
    id: number,
    data: {
      name?: string;
      phone?: string;
      city?: string;
      address?: string;
      consoleType?: string;
      emailLogin?: string;
      emailPassword?: string;
      accountPassword?: string;
    },
  ) {
    return this.prisma.client.update({
      where: { id },
      data,
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' as any },
          include: {
            clientSlot: {
              include: {
                sharingSystem: {
                  include: { donor: true },
                },
              },
            },
            donorAccount: true,
          },
          take: 1,
        },
        orders: {
          where: { status: OrderStatus.COMPLETED },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    serialNumber: true,
                    category: true,
                    price: true,
                  },
                },
              },
            },
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
            manager: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { date: 'desc' },
          take: 100,
        },
      } as any,
    });
  }

  async remove(id: number) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        orders: true,
        subscriptions: true,
        tasks: true,
        tradeIns: true,
        clientSlots: true,
      } as any,
    });

    if (!client) {
      throw new BadRequestException('Клиент не найден');
    }

    if (client.clientSlots && client.clientSlots.length > 0) {
      throw new BadRequestException(
        `Невозможно удалить клиента. Он подключен к системе шеринга. Сначала отвяжите его.`,
      );
    }

    if (client.orders && client.orders.length > 0) {
      throw new BadRequestException(
        `Невозможно удалить клиента. У него есть ${client.orders.length} заказ(ов). Сначала удалите заказы.`,
      );
    }

    if (client.subscriptions && client.subscriptions.length > 0) {
      throw new BadRequestException(
        `Невозможно удалить клиента. У него есть ${client.subscriptions.length} подписк(и). Сначала удалите подписки.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.subscription.deleteMany({
        where: {
          clientId: id,
          clientSlotId: null,
        },
      }),
      this.prisma.task.deleteMany({ where: { clientId: id } }),
      this.prisma.tradeIn.deleteMany({ where: { clientId: id } }),
      this.prisma.client.delete({ where: { id } }),
    ]);

    return { success: true, message: 'Клиент удалён' };
  }

  async findOne(id: number) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' as any },
          include: {
            clientSlot: {
              include: {
                sharingSystem: {
                  include: { donor: true },
                },
              },
            },
            donorAccount: true,
          },
          orderBy: { endDate: 'desc' },
          take: 1,
        },
        // ✅ ПОЛНАЯ ИСТОРИЯ ЗАКАЗОВ СО ВСЕМИ ДЕТАЛЯМИ
        orders: {
          where: { status: OrderStatus.COMPLETED },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    serialNumber: true,
                    category: true,
                    price: true,
                    costPrice: true,
                  },
                },
              },
            },
            // ✅ КТО СОЗДАЛ ЗАКАЗ
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
            // ✅ КТО ЗАКРЫЛ/НАЗНАЧИЛ ЗАКАЗ
            manager: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { date: 'desc' },
          take: 100,
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Клиент не найден');
    }

    return client;
  }
}