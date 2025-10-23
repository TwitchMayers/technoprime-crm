import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma, OrderStatus, TaskStatus, TaskType } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { EventsService } from '../events/events.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private events: EventsService,
  ) {}

  private mapStatus(v?: string) {
    if (!v) return undefined;
    const key = v.toUpperCase() as keyof typeof OrderStatus;
    return OrderStatus[key] ?? undefined;
  }

  async list(params: { status?: string; assigneeId?: string; q?: string; dateFrom?: string; dateTo?: string }) {
    const where: Prisma.OrderWhereInput = {};
    const st = this.mapStatus(params.status);
    if (st) where.status = st;
    if (params.assigneeId) where.managerId = Number(params.assigneeId);
    if (params.dateFrom || params.dateTo) {
      where.date = {};
      if (params.dateFrom) where.date.gte = new Date(params.dateFrom);
      if (params.dateTo) where.date.lte = new Date(params.dateTo);
    }
    if (params.q) {
      where.client = {
        OR: [
          { name: { contains: params.q, mode: 'insensitive' } },
          { phone: { contains: params.q, mode: 'insensitive' } },
        ],
      };
    }

    return this.prisma.order.findMany({
      where,
      include: {
        client: true,
        manager: true,
        createdBy: true,
        items: { include: { product: true } },
      },
      orderBy: { id: 'desc' },
    });
  }

  async queue() {
    return this.prisma.order.findMany({
      where: { status: OrderStatus.NEW, managerId: null },
      include: { client: true },
      orderBy: { id: 'desc' },
    });
  }

  async create(dto: CreateOrderDto) {
    if (!dto.items?.length) throw new BadRequestException('Order must have items');

    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    const byId = new Map(products.map((p) => [p.id, p]));

    let totalPrice = 0;
    let totalCost = 0;

    const orderItems: Prisma.OrderItemCreateManyOrderInput[] = dto.items.map((i) => {
      const p = byId.get(i.productId);
      if (!p) throw new BadRequestException(`Product ${i.productId} not found`);
      if (p.isArchived) throw new BadRequestException(`Product ${p.name} is archived`);
      if (p.stock < i.qty) throw new BadRequestException(`Not enough stock for product ${p.name}`);

      const unitCost = Number(p.costPrice);
      const unitPrice = Number(i.salePrice);
      const lineCost = unitCost * i.qty;
      const lineTotal = unitPrice * i.qty;

      totalCost += lineCost;
      totalPrice += lineTotal;

      return {
        productId: p.id,
        qty: i.qty,
        unitCost: unitCost.toFixed(2) as any,
        unitPrice: unitPrice.toFixed(2) as any,
        lineCost: lineCost.toFixed(2) as any,
        lineTotal: lineTotal.toFixed(2) as any,
      };
    });

    const profit = totalPrice - totalCost;

    const created = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          clientId: dto.clientId,
          managerId: dto.managerId ?? null,
          createdById: dto.managerId ?? 1, // временно
          paymentMethod: dto.paymentMethod as any,
          status: OrderStatus.NEW,
          totalPrice: totalPrice.toFixed(2) as any,
          costPrice: totalCost.toFixed(2) as any,
          profit: profit.toFixed(2) as any,
          comment: dto.comment,
          items: { createMany: { data: orderItems } },
        },
        include: { client: true, items: { include: { product: true } } },
      });

      // создаем задачу NEW без исполнителя (в очередь)
      await tx.task.create({
        data: {
          title: `Заказ #${order.id} — ${order.client?.name || ''}`,
          type: TaskType.DELIVERY,
          assignedToId: 1, // по умолчанию владелец, можно держать null, если модель позволит
          clientId: order.clientId,
          orderId: order.id,
          dueDate: new Date(),
          status: TaskStatus.NEW,
          comment: order.comment || '',
        },
      });

      // списание склада
      for (const it of dto.items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.qty } },
        });
      }
      return order;
    });

    if (!created.managerId) {
      await this.prisma.notification.create({
        data: { userId: 1, type: 'ORDER_CREATED', payload: { orderId: created.id, client: created.client?.name } },
      });
      this.events.notifyUser(1, 'ORDER_CREATED', { orderId: created.id });
      this.events.queueUpdated();
    }

    return created;
  }

  async assign(orderId: number, assigneeId: number) {
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { managerId: assigneeId, status: OrderStatus.IN_PROGRESS },
      include: { client: true },
    });

    // задача -> IN_PROGRESS + назначить исполнителя
    const task = await this.prisma.task.findFirst({ where: { orderId } });
    if (task) {
      await this.prisma.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.IN_PROGRESS, assignedToId: assigneeId },
      });
    }

    await this.prisma.notification.create({
      data: { userId: assigneeId, type: 'ORDER_ASSIGNED', payload: { orderId: order.id, client: order.client?.name } },
    });
    this.events.notifyUser(assigneeId, 'ORDER_ASSIGNED', { orderId: order.id });
    this.events.queueUpdated();
    return order;
  }

  async setStatus(orderId: number, status: keyof typeof OrderStatus, archiveOnComplete?: boolean) {
    const st = OrderStatus[status] ?? OrderStatus.NEW;

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: st, archiveOnComplete: archiveOnComplete ?? undefined },
      include: { items: { include: { product: true } }, createdBy: true, manager: true, client: true },
    });

    // задача -> DONE при завершении
    const task = await this.prisma.task.findFirst({ where: { orderId } });
    if (task && st === OrderStatus.COMPLETED) {
      await this.prisma.task.update({ where: { id: task.id }, data: { status: TaskStatus.DONE } });
    }

    // архивация консолей
    if (st === OrderStatus.COMPLETED && (archiveOnComplete || order.archiveOnComplete)) {
      const consoleItems = order.items.filter((i) => i.product.category === 'CONSOLE');
      await this.prisma.$transaction(
        consoleItems.map((i) =>
          this.prisma.product.update({
            where: { id: i.productId },
            data: { isArchived: true, archivedAt: new Date() },
          }),
        ),
      );
    }

    await this.prisma.notification.create({
      data: { userId: order.createdById, type: 'ORDER_STATUS', payload: { orderId: order.id, status: st } },
    });
    this.events.notifyUser(order.createdById, 'ORDER_STATUS', { orderId: order.id, status: st });
    this.events.queueUpdated();

    return order;
  }

  comments(orderId: number) {
    return this.prisma.orderComment.findMany({
      where: { orderId },
      include: { author: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(orderId: number, authorId: number, text: string) {
    if (!text?.trim()) throw new BadRequestException('Empty comment');

    const comment = await this.prisma.orderComment.create({
      data: { orderId, authorId, text },
    });

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    const targets = new Set<number>();
    if (order?.managerId && order.managerId !== authorId) targets.add(order.managerId);
    if (order?.createdById && order.createdById !== authorId) targets.add(order.createdById);

    if (targets.size) {
      await this.prisma.$transaction(
        Array.from(targets).map((uid) =>
          this.prisma.notification.create({
            data: { userId: uid, type: 'ORDER_COMMENT', payload: { orderId, commentId: comment.id } },
          }),
        ),
      );
      Array.from(targets).forEach((uid) =>
        this.events.notifyUser(uid, 'ORDER_COMMENT', { orderId, commentId: comment.id }),
      );
    }

    return comment;
  }
}