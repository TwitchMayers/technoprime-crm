import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TaskType, TaskStatus } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  private readonly taskListInclude = {
    assignedTo: {
      select: {
        id: true,
        name: true,
        login: true,
      } as any,
    },
    acceptedBy: {
      select: {
        id: true,
        name: true,
        login: true,
      } as any,
    },
    client: {
      select: {
        id: true,
        name: true,
        phone: true,
      },
    },
    order: {
      select: {
        id: true,
        status: true,
        totalPrice: true,
        source: true,
        reserveUntil: true,
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    },
  } as const;

  private readonly taskDetailsInclude = {
    assignedTo: {
      select: {
        id: true,
        name: true,
        login: true,
      } as any,
    },
    acceptedBy: {
      select: {
        id: true,
        name: true,
        login: true,
      } as any,
    },
    client: {
      select: {
        id: true,
        name: true,
        phone: true,
        city: true,
        address: true,
      },
    },
    order: {
      select: {
        id: true,
        status: true,
        totalPrice: true,
        date: true,
        source: true,
        reserveUntil: true,
        paymentMethod: true,
        comment: true,
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            city: true,
            address: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                category: true,
                brand: true,
                model: true,
                serialNumber: true,
              },
            },
            inventoryUnits: {
              select: {
                id: true,
                serialNumber: true,
              },
            },
          },
        },
      },
    },
  } as const;

  async list(query?: {
    assignedToId?: string;
    status?: string;
    clientId?: string;
    limit?: string | number;
    offset?: string | number;
  }) {
    const where: any = {
      NOT: [{ comment: { contains: '[SHOP_CHAT]' } }, { comment: { contains: '[SHOP_LEAD]' } }],
    };

    const parsedLimit = Number(query?.limit);
    const parsedOffset = Number(query?.offset);
    const take = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 500)
      : 240;
    const skip = Number.isFinite(parsedOffset)
      ? Math.min(Math.max(Math.trunc(parsedOffset), 0), 5000)
      : 0;

    // КРИТИЧЕСКИ ВАЖНО - фильтр по исполнителю
    if (query?.assignedToId) {
      where.assignedToId = Number(query.assignedToId);
    }

    if (query?.status) {
      const statusUpper = query.status.toUpperCase();
      if (statusUpper === 'NEW' || statusUpper === 'IN_PROGRESS' || statusUpper === 'DONE') {
        where.status = statusUpper as TaskStatus;
      }
    }

    if (query?.clientId) {
      where.clientId = Number(query.clientId);
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: this.taskListInclude as any,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      take,
      skip,
    });

    return tasks;
  }

  async create(data: {
    title: string;
    type: TaskType;
    assignedToId: number;
    clientId?: number;
    orderId?: number;
    dueDate: Date;
    comment?: string;
  }) {
    return this.prisma.task.create({
      data: {
        title: data.title,
        type: data.type,
        assignedToId: data.assignedToId,
        clientId: data.clientId,
        orderId: data.orderId,
        dueDate: data.dueDate,
        comment: data.comment,
        status: TaskStatus.NEW,
      },
      include: this.taskDetailsInclude as any,
    });
  }

  async update(
    id: number,
    data: { status?: TaskStatus; comment?: string },
    options?: { acceptedByUserId?: number },
  ) {
    const existing = await this.prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        acceptedById: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Задача не найдена');
    }

    const nextData: any = { ...data };
    const acceptedByUserId = Number(options?.acceptedByUserId || 0);

    if (
      data.status === TaskStatus.IN_PROGRESS &&
      Number.isFinite(acceptedByUserId) &&
      acceptedByUserId > 0
    ) {
      nextData.assignedToId = acceptedByUserId;
      if (!existing.acceptedById || existing.status === TaskStatus.NEW) {
        nextData.acceptedById = acceptedByUserId;
        nextData.acceptedAt = new Date();
      }
    }

    return this.prisma.task.update({
      where: { id },
      data: nextData,
      include: this.taskDetailsInclude as any,
    });
  }

  async updateIfOwner(id: number, userId: number, data: { status?: TaskStatus; comment?: string }) {
    // Проверяем, что задача принадлежит пользователю
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }

    if (task.assignedToId !== userId) {
      throw new ForbiddenException('Вы можете обновлять только свои задачи');
    }

    return this.update(id, data, { acceptedByUserId: userId });
  }

  async delete(id: number) {
    return this.prisma.task.delete({
      where: { id },
    });
  }

  async findOne(id: number) {
    return this.prisma.task.findUnique({
      where: { id },
      include: this.taskDetailsInclude as any,
    });
  }
}
