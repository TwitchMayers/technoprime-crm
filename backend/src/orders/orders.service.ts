import {
  BadRequestException,
  Injectable,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  Prisma,
  OrderStatus,
  TaskStatus,
  TaskType,
  SubscriptionType,
  AccountType,
  SubscriptionPeriod,
} from '@prisma/client';
import { EventsService } from '../events/events.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SharingSystemsService } from '../sharing-systems/sharing-systems.service';
import Decimal from 'decimal.js';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private events: EventsService,
    @Inject(forwardRef(() => SubscriptionsService))
    private subscriptionsService: SubscriptionsService,
    @Inject(forwardRef(() => SharingSystemsService))
    private sharingSystemsService: SharingSystemsService,
  ) {}

  private mapStatus(v?: string) {
    if (!v) return undefined;
    const key = v.toUpperCase() as keyof typeof OrderStatus;
    return OrderStatus[key] ?? undefined;
  }

  private money(v: any) {
    const d = v instanceof Decimal ? v : new Decimal(v || 0);
    return new Prisma.Decimal(d.toFixed(2));
  }

  // ✅ НОВЫЙ МЕТОД: синхронизация статуса заказа по статусу задач
  async syncOrderStatusFromTasks(orderId: number): Promise<void> {
    console.log(`🔄 Syncing order ${orderId} status from tasks...`);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });

    if (!order) {
      console.warn(`⚠️ Order ${orderId} not found`);
      return;
    }

    // Получаем все задачи для этого заказа
    const tasks = await this.prisma.task.findMany({
      where: { orderId },
      select: { id: true, status: true },
    });

    if (tasks.length === 0) {
      console.log(`⚠️ No tasks found for order ${orderId}`);
      return;
    }

    console.log(
      `📋 Found ${tasks.length} tasks for order ${orderId}:`,
      tasks.map((t) => `Task#${t.id}:${t.status}`).join(', '),
    );

    // Проверяем статусы всех задач
    const allDone = tasks.every((t) => t.status === TaskStatus.DONE);
    const anyInProgress = tasks.some((t) => t.status === TaskStatus.IN_PROGRESS);

    let newOrderStatus = order.status;

    // Логика: если ВСЕ задачи DONE → заказ COMPLETED
    if (allDone && order.status !== OrderStatus.COMPLETED) {
      newOrderStatus = OrderStatus.COMPLETED;
      console.log(
        `✅ All tasks are DONE → Order status should be COMPLETED`,
      );
    }
    // Если есть IN_PROGRESS → заказ IN_PROGRESS
    else if (
      anyInProgress &&
      order.status !== OrderStatus.IN_PROGRESS &&
      order.status !== OrderStatus.COMPLETED
    ) {
      newOrderStatus = OrderStatus.IN_PROGRESS;
      console.log(`✅ Some tasks are IN_PROGRESS → Order status should be IN_PROGRESS`);
    }

    // Если статус изменился → обновляем заказ
    if (newOrderStatus !== order.status) {
      console.log(
        `📊 Updating order ${orderId} status: ${order.status} → ${newOrderStatus}`,
      );

      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: newOrderStatus },
      });

      // Архивируем товары если заказ завершен
      if (newOrderStatus === OrderStatus.COMPLETED) {
        console.log(`📦 Archiving products for completed order ${orderId}`);
        
        const orderWithItems = await this.prisma.order.findUnique({
          where: { id: orderId },
          include: { items: true },
        });

        if (orderWithItems?.items) {
          for (const item of orderWithItems.items) {
            await this.prisma.product.update({
              where: { id: item.productId },
              data: {
                isActive: false,
                archivedAt: new Date(),
              },
            });
          }
        }

        console.log(`✅ Products archived for order ${orderId}`);
      }

      // Отправляем уведомление
      try {
        const updatedOrder = await this.prisma.order.findUnique({
          where: { id: orderId },
          select: { createdById: true },
        });

        if (updatedOrder?.createdById) {
          await this.prisma.notification.create({
            data: {
              userId: updatedOrder.createdById,
              type: 'ORDER_STATUS',
              payload: {
                orderId,
                status: newOrderStatus,
              } as any,
            },
          });

          this.events.notifyUser(updatedOrder.createdById, 'ORDER_STATUS', {
            orderId,
            status: newOrderStatus,
          });
          this.events.queueUpdated();
        }
      } catch (err) {
        console.error('Failed to send notification:', err);
      }
    } else {
      console.log(`ℹ️ Order ${orderId} status is already correct: ${order.status}`);
    }
  }

  async list(params: {
    status?: string;
    assigneeId?: string;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(params.page) || 1;
    const limit = Math.min(Number(params.limit) || 50, 100);
    const skip = (page - 1) * limit;

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

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          date: true,
          status: true,
          totalPrice: true,
          client: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          manager: {
            select: {
              id: true,
              name: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { id: 'desc' },
      }),
      this.prisma.order.count({ where }),
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

  async queue() {
    return this.prisma.order.findMany({
      where: { status: OrderStatus.NEW, managerId: null },
      select: {
        id: true,
        date: true,
        status: true,
        totalPrice: true,
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { id: 'desc' },
      take: 50,
    });
  }

  async create(
    dto: {
      clientId: number;
      paymentMethod: 'CASH' | 'TRANSFER' | 'TRADE_IN';
      comment?: string;
      items: { productId: number; qty: number; salePrice: number }[];
      subscription?: {
        createSubscription: boolean;
        type?: SubscriptionType;
        accountType?: AccountType;
        subscriptionPeriod?: SubscriptionPeriod;
        sharingSystemId?: number;
        consoleType?: 'PS4' | 'PS5';
        emailLogin?: string;
        emailPassword?: string;
        accountPassword?: string;
      };
    },
    createdById: number,
  ) {
    if (!dto.items?.length)
      throw new BadRequestException('Позиции заказа пусты');

    const created = await this.prisma.$transaction(async (tx) => {
      // ✅ 1. Создаём заказ
      const order = await tx.order.create({
        data: {
          clientId: dto.clientId,
          createdById,
          paymentMethod: dto.paymentMethod as any,
          comment: dto.comment ?? '',
          status: OrderStatus.NEW,
          totalPrice: this.money(0),
          costPrice: this.money(0),
          profit: this.money(0),
          date: new Date(),
        },
        include: { client: true },
      });

      let totalSale = new Decimal(0);
      let totalCost = new Decimal(0);
      let firstSerial: string | null = null;

      // ✅ 2. Обрабатываем товары
      for (const it of dto.items) {
        const qty = Math.max(1, Number(it.qty || 1));

        const product = (await tx.product.findUnique({
          where: { id: it.productId },
          select: {
            id: true,
            name: true,
            stock: true,
            isActive: true,
            price: true,
            costPrice: true,
            serialNumber: true,
            category: true,
          },
        })) as any;

        if (!product)
          throw new BadRequestException(`Товар #${it.productId} не найден`);
        if (product.isActive === false)
          throw new BadRequestException(`Товар ${product.name} в архиве`);
        if ((product.stock ?? 0) < qty) {
          throw new BadRequestException(
            `Недостаточно остатка по ${product.name} (доступно: ${product.stock})`,
          );
        }

        const up = new Decimal(it.salePrice ?? product.price ?? 0);
        const uc = new Decimal(product.costPrice ?? 0);
        const lt = up.mul(qty);
        const lc = uc.mul(qty);

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            qty,
            unitPrice: this.money(up),
            unitCost: this.money(uc),
            lineTotal: this.money(lt),
            lineCost: this.money(lc),
          } as any,
        });

        await tx.product.update({
          where: { id: product.id },
          data: { stock: (product.stock ?? 0) - qty },
        });

        if (!firstSerial)
          firstSerial = product.serialNumber || product.name || null;
        totalSale = totalSale.add(lt);
        totalCost = totalCost.add(lc);
      }

      // ✅ 3. Обновляем итоговые цены заказа
      await tx.order.update({
        where: { id: order.id },
        data: {
          totalPrice: this.money(totalSale),
          costPrice: this.money(totalCost),
          profit: this.money(totalSale.sub(totalCost)),
        },
      });

      // ✅ 4. Создаём подписку если нужна
      if (dto.subscription?.createSubscription && dto.subscription.type) {
        try {
          if (
            dto.subscription.accountType === AccountType.SHARING_CLIENT &&
            dto.subscription.sharingSystemId &&
            dto.subscription.consoleType
          ) {
            const sharingData = {
              clientId: dto.clientId,
              sharingSystemId: dto.subscription.sharingSystemId,
              consoleType: dto.subscription.consoleType,
              startDate: new Date().toISOString(),
              endDate: new Date(
                Date.now() + 365 * 24 * 60 * 60 * 1000,
              ).toISOString(),
              notes: `Создано автоматически из заказа #${order.id}`,
            };

            await this.sharingSystemsService.assignClientToSlot(sharingData);
          } else {
            const subscriptionData = {
              clientId: dto.clientId,
              type: dto.subscription.type,
              startDate: new Date().toISOString(),
              endDate: new Date(
                Date.now() +
                  this.getSubscriptionMonths(dto.subscription.subscriptionPeriod) *
                    30 *
                    24 *
                    60 *
                    60 *
                    1000,
              ).toISOString(),
              status: 'ACTIVE' as const,
              managerId: createdById,
              accountType:
                dto.subscription.accountType || AccountType.PERSONAL,
              subscriptionPeriod:
                dto.subscription.subscriptionPeriod ||
                SubscriptionPeriod.MONTH,
              psEmail: dto.subscription.emailLogin,
              psPassword: dto.subscription.emailPassword,
              accountPassword: dto.subscription.accountPassword,
            };

            await this.subscriptionsService.create(subscriptionData);
          }
        } catch (subscriptionError) {
          console.error('Ошибка при создании подписки:', subscriptionError);
        }
      }

      // ✅ 5. Определяем, кому назначить задачу
      let assigneeDefaultId = createdById;

      const anyTech = await tx.employee.findFirst({
        where: { role: 'TECHNICAL_SPECIALIST' },
        select: { id: true, name: true },
        orderBy: { id: 'asc' },
      });

      if (anyTech) {
        assigneeDefaultId = anyTech.id;
      }

      console.log(
        '📝 Creating task for order:',
        order.id,
        'initial assignee:',
        assigneeDefaultId,
      );

      // ✅ 6. Создаём задачу
      try {
        const task = await tx.task.create({
          data: {
            title: `Заказ #${order.id}${firstSerial ? ` • ${firstSerial}` : ''}`,
            comment: `${order.client?.name || ''} • ${order.client?.phone || ''}`,
            type: TaskType.OTHER,
            status: TaskStatus.NEW,
            orderId: order.id,
            clientId: order.clientId,
            assignedToId: assigneeDefaultId,
            dueDate: new Date(),
          },
        });

        console.log('✅ Task created:', task.id);
      } catch (taskError) {
        console.warn('⚠️ Failed to create task for order:', taskError.message);
      }

      return order;
    });

    // ✅ 7. Отправляем уведомления (вне транзакции)
    try {
      await this.prisma.notification.create({
        data: {
          userId: createdById,
          type: 'ORDER_CREATED',
          payload: {
            orderId: created.id,
            clientName: created.client?.name,
          } as any,
        },
      });

      this.events.notifyUser(createdById, 'ORDER_CREATED', {
        orderId: created.id,
        title: 'Новый заказ создан',
        text: `Заказ #${created.id} для ${created.client?.name || 'клиента'}`,
      });

      this.events.broadcast('ORDER_CREATED', {
        orderId: created.id,
        title: 'Новый заказ',
        text: `Создан заказ #${created.id}`,
      });

      this.events.queueUpdated();
    } catch (err) {
      console.error('Failed to send notifications:', err);
    }

    return created;
  }

  private getSubscriptionMonths(period?: SubscriptionPeriod): number {
    switch (period) {
      case SubscriptionPeriod.THREE_MONTHS:
        return 3;
      case SubscriptionPeriod.YEAR:
        return 12;
      default:
        return 1;
    }
  }

  async assign(orderId: number, assigneeId: number) {
    if (!orderId || Number.isNaN(orderId)) {
      throw new BadRequestException('orderId is required');
    }

    let employeeId = Number(assigneeId || 0);
    if (employeeId) {
      const exists = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true },
      });
      if (!exists) employeeId = 0;
    }

    if (!employeeId) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { createdById: true },
      });
      if (order?.createdById) {
        employeeId = order.createdById;
      } else {
        const anyEmp = await this.prisma.employee.findFirst({
          select: { id: true },
        });
        if (!anyEmp)
          throw new BadRequestException('Нет сотрудников для назначения');
        employeeId = anyEmp.id;
      }
    }

    console.log(`📌 Assigning order ${orderId} to employee ${employeeId}`);

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        managerId: employeeId,
        status: OrderStatus.IN_PROGRESS,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(`✅ Order ${orderId} status changed to IN_PROGRESS`);

    const task = await this.prisma.task.findFirst({
      where: { orderId },
      select: { id: true },
    });

    if (task) {
      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.IN_PROGRESS,
          assignedToId: employeeId,
        },
      });
      console.log(
        `✅ Task ${task.id} updated: status=IN_PROGRESS, assignedToId=${employeeId}`,
      );
    } else {
      console.warn(`⚠️ No task found for order ${orderId}`);
    }

    try {
      await this.prisma.notification.create({
        data: {
          userId: employeeId,
          type: 'ORDER_ASSIGNED',
          payload: { orderId: order.id, client: order.client?.name } as any,
        },
      });
      this.events.notifyUser(employeeId, 'ORDER_ASSIGNED', {
        orderId: order.id,
        title: 'Заказ назначен вам',
        text: `Вам назначен заказ #${order.id}`,
      });
      this.events.queueUpdated();
    } catch (err) {
      console.error('Failed to send notification:', err);
    }

    return order;
  }

  async findOne(id: number) {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            city: true,
            address: true,
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
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                category: true,
                serialNumber: true,
                isActive: true,
                stock: true,
                price: true,
                costPrice: true,
              },
            },
          },
        },
      },
    });
  }

  async setStatus(
    orderId: number,
    status: keyof typeof OrderStatus,
    archiveOnComplete?: boolean,
    managerId?: number,
  ) {
    if (!orderId || Number.isNaN(orderId)) {
      throw new BadRequestException('orderId is required');
    }
    const st = OrderStatus[status] ?? OrderStatus.NEW;

    // ✅ КЛЮЧЕВАЯ ЛОГИКА: сохраняем managerId когда заказ завершается
    const updateData: any = {
      status: st,
      archiveOnComplete: archiveOnComplete ?? undefined,
    };

    // ✅ Если статус COMPLETED и есть managerId — сохраняем его
    if (st === OrderStatus.COMPLETED && managerId && managerId > 0) {
      updateData.managerId = managerId;
      console.log(`✅ Setting managerId = ${managerId} for completed order ${orderId}`);
    }

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                category: true,
                isActive: true,
                serialNumber: true,
                price: true,
              },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
        manager: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true, name: true },
        },
      },
    });

    const task = await this.prisma.task.findFirst({
      where: { orderId },
      select: { id: true },
    });

    if (task && st === OrderStatus.COMPLETED) {
      await this.prisma.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.DONE },
      });
    }

    // ✅ Архивирование товаров если завершён
    if (st === OrderStatus.COMPLETED) {
      console.log(`📦 Processing completed order ${orderId}`);

      for (const item of order.items) {
        console.log(`📦 Processing product: ${item.product.name}`);

        await this.prisma.product.update({
          where: { id: item.productId },
          data: {
            isActive: false,
            archivedAt: new Date(),
          },
        });

        console.log(`✅ Product archived: ${item.product.name}`);
      }
    }

    try {
      await this.prisma.notification.create({
        data: {
          userId: order.createdById,
          type: 'ORDER_STATUS',
          payload: {
            orderId: order.id,
            status: st,
            managerId: order.managerId,
          } as any,
        },
      });
      this.events.notifyUser(order.createdById, 'ORDER_STATUS', {
        orderId: order.id,
        status: st,
      });
      this.events.queueUpdated();
    } catch {}

    return order;
  }

  async comments(orderId: number) {
    return this.prisma.orderComment.findMany({
      where: { orderId },
      select: {
        id: true,
        text: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(orderId: number, authorId: number, text: string) {
    if (!text?.trim()) throw new BadRequestException('Empty comment');

    const comment = await this.prisma.orderComment.create({
      data: { orderId, authorId, text },
      select: {
        id: true,
        text: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        managerId: true,
        createdById: true,
      },
    });

    const targets = new Set<number>();
    if (order?.managerId && order.managerId !== authorId)
      targets.add(order.managerId);
    if (order?.createdById && order.createdById !== authorId)
      targets.add(order.createdById);

    if (targets.size) {
      await this.prisma.$transaction(
        Array.from(targets).map((uid) =>
          this.prisma.notification.create({
            data: {
              userId: uid,
              type: 'ORDER_COMMENT',
              payload: { orderId, commentId: comment.id } as any,
            },
          }),
        ),
      );
      Array.from(targets).forEach((uid) =>
        this.events.notifyUser(uid, 'ORDER_COMMENT', {
          orderId,
          commentId: comment.id,
        }),
      );
    }

    return comment;
  }

  async delete(orderId: number, adminId: number) {
    const admin = await this.prisma.employee.findUnique({
      where: { id: adminId },
      select: { id: true, role: true },
    });

    if (!admin || admin.role !== 'SUPER_ADMIN') {
      throw new BadRequestException(
        'Только администратор может удалять заказы',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  stock: true,
                  category: true,
                  isActive: true,
                },
              },
            },
          },
          client: {
            select: {
              id: true,
              name: true,
              subscriptions: {
                where: {
                  status: 'ACTIVE' as any,
                  createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                  },
                },
                include: {
                  clientSlot: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw new BadRequestException('Заказ не найден');
      }

      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: (item.product.stock || 0) + item.qty,
            isActive: true,
            archivedAt: null,
          },
        });
      }

      if (order.client.subscriptions.length > 0) {
        for (const subscription of order.client.subscriptions) {
          if (subscription.clientSlot) {
            await tx.clientSlot.update({
              where: { id: subscription.clientSlot.id },
              data: { isActive: false },
            });
          }
          await tx.subscription.delete({
            where: { id: subscription.id },
          });
        }
      }

      await tx.task.deleteMany({ where: { orderId } });
      await tx.orderComment.deleteMany({ where: { orderId } });
      await tx.orderItem.deleteMany({ where: { orderId } });
      await tx.order.delete({ where: { id: orderId } });

      try {
        await tx.notification.create({
          data: {
            userId: order.createdById,
            type: 'ORDER_DELETED',
            payload: {
              orderId,
              clientName: order.client?.name,
              deletedBy: adminId,
            } as any,
          },
        });
      } catch {}

      return {
        success: true,
        message:
          'Заказ удалён, товары возвращены на склад, подписки отменены',
      };
    });
  }
}