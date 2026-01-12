import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Tenant, TaskStatus, OrderStatus } from '@prisma/client';
import { RichMarketOrdersService } from '../orders/richmarket-orders.service';


@Injectable()
export class RichMarketTasksService {
  constructor(
    private prisma: PrismaService,
    private ordersService: RichMarketOrdersService, // Добавляем сервис заказов
  ) {}

  async list(query?: { status?: string; assignedToId?: string }) {
    const where: any = { tenant: Tenant.RICHMARKET };

    if (query?.status) {
      where.status = query.status.toUpperCase() as TaskStatus;
    }

    if (query?.assignedToId) {
      where.assignedToId = Number(query.assignedToId);
    }

    return this.prisma.richMarketTask.findMany({
      where,
      include: {  
        client: true,
        order: {
          include: {
            items: {
              include: {
                product: true
                } as any as any
            }
          }
        },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
  }

  async update(id: number, data: { status?: TaskStatus; comment?: string }) {
    // Сначала получаем задачу с информацией о заказе
    const task = await this.prisma.richMarketTask.findUnique({
      where: { id },
      include: { 
        order: true
       } as any
    });

    if (!task) {
      throw new BadRequestException('Задача не найдена');
    }

    // Если задача завершается и у нее есть связанный заказ
    if (data.status === TaskStatus.DONE && task.orderId) {
      // Завершаем заказ (это автоматически архивирует товары)
      await this.ordersService.complete(task.orderId);
    }

    // Обновляем саму задачу
    return this.prisma.richMarketTask.update({
      where: { id },
      data,
    });
  }
}