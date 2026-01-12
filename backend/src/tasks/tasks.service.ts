import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TaskType, TaskStatus } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async list(query?: { 
    assignedToId?: string; 
    status?: string; 
    clientId?: string;
  }) {
    const where: any = {};

    // КРИТИЧЕСКИ ВАЖНО - фильтр по исполнителю
    if (query?.assignedToId) {
      where.assignedToId = Number(query.assignedToId);
      console.log('🔒 Filtering tasks by assignedToId:', where.assignedToId);
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
      include: {  
        assignedTo: {
          select: {
            id: true,
            name: true,
            login: true,
            } as any as any,
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
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { dueDate: 'asc' },
      ],
    });

    console.log(`📋 Found ${tasks.length} tasks with filter:`, where);

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
      include: {  
        assignedTo: true,
        client: true,
        order: true,
        } as any as any,
    });
  }

  async update(id: number, data: { status?: TaskStatus; comment?: string }) {
    return this.prisma.task.update({
      where: { id },
      data,
      include: {  
        assignedTo: true,
        client: true,
        order: true,
        } as any as any,
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

    return this.update(id, data);
  }

  async delete(id: number) {
    return this.prisma.task.delete({
      where: { id },
    });
  }

  async findOne(id: number) {
  return this.prisma.task.findUnique({
    where: { id },
    include: {  
      assignedTo: true,
      client: true,
      order: true,
      } as any as any,
  });
}
}