import { BadRequestException, Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  Prisma,
  OrderStatus,
  OrderSource,
  TaskStatus,
  TaskType,
  SubscriptionType,
  AccountType,
  SubscriptionPeriod,
  InventoryUnitStatus,
  FulfillmentMethod,
  SalesChannel,
  ShipmentCarrier,
  ShipmentStatus,
  ShipmentSyncMode,
  SettlementStatus,
  Role,
} from '@prisma/client';
import { EventsService } from '../events/events.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SharingSystemsService } from '../sharing-systems/sharing-systems.service';
import { InventoryService } from '../inventory/inventory.service';
import Decimal from 'decimal.js';
import { ShopCrmSyncService } from '../shop/shop-crm-sync.service';
import {
  buildShopLeadTaskComment,
  buildShopLeadTaskTitle,
  formatShopLeadComment,
  parseShopLeadComment,
} from '../shop/shop-lead.util';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private events: EventsService,
    private inventory: InventoryService,
    private crmSync: ShopCrmSyncService,
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

  private moneyOptional(v: any) {
    if (v === undefined || v === null || v === '') return undefined;
    const d = new Decimal(v || 0);
    if (!d.isFinite()) return undefined;
    return new Prisma.Decimal(d.toFixed(2));
  }

  private enumValue<T extends Record<string, string>>(
    enumObject: T,
    value: any,
    fallback: T[keyof T],
  ): T[keyof T] {
    const key = String(value || '').toUpperCase();
    return (enumObject as unknown as Record<string, T[keyof T]>)[key] || fallback;
  }

  private parseDate(value?: string | Date | null) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private normalizeText(value?: string | null) {
    const text = String(value || '').trim();
    return text || null;
  }

  private normalizePhone(input: string) {
    const digits = String(input || '').replace(/\D/g, '');
    if (digits.length === 10) return `7${digits}`;
    if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
    return digits;
  }

  private validateCustomerPhone(input: string) {
    const rawDigits = String(input || '').replace(/\D/g, '');
    const normalized = this.normalizePhone(input || '');

    if (!rawDigits) {
      throw new BadRequestException('Укажите номер телефона.');
    }
    if (rawDigits.length < 11) {
      throw new BadRequestException(
        'Введите полный номер телефона: 11 цифр в формате +7 (9XX) XXX-XX-XX.',
      );
    }
    if (normalized.length !== 11 || !normalized.startsWith('7')) {
      throw new BadRequestException('Введите номер в формате +7 (9XX) XXX-XX-XX.');
    }
    if (!/^79\d{9}$/.test(normalized)) {
      throw new BadRequestException(
        'Укажите действующий мобильный номер в формате +7 (9XX) XXX-XX-XX.',
      );
    }

    return normalized;
  }

  private async writeAuditLog(
    userId: number | null | undefined,
    action: string,
    entityType: string,
    entityId: number | null | undefined,
    newData?: Record<string, any> | null,
    oldData?: Record<string, any> | null,
  ) {
    if (!userId) return;

    await this.prisma.auditLog
      .create({
        data: {
          userId,
          action,
          entityType,
          entityId: entityId || null,
          oldData: (oldData || undefined) as any,
          newData: (newData || undefined) as any,
        },
      })
      .catch(() => undefined);
  }

  private isShopLeadComment(comment?: string | null) {
    return String(comment || '').includes('[SHOP_LEAD]');
  }

  private getLeadPrimaryProduct(order: {
    items?: Array<{
      product?: { id: number; name: string | null } | null;
      productId?: number;
      inventoryUnits?: Array<{ serialNumber?: string | null }>;
    }>;
  }) {
    const item = order.items?.[0];
    if (!item) return { productName: null as string | null, serialNumber: null as string | null };
    return {
      productName: item.product?.name || null,
      serialNumber: item.inventoryUnits?.find(unit => unit.serialNumber)?.serialNumber || null,
    };
  }

  private async syncLeadTask(
    tx: Prisma.TransactionClient,
    input: {
      orderId: number;
      clientId: number;
      clientName?: string | null;
      requestedPhone?: string | null;
      productName?: string | null;
      city?: string | null;
      address?: string | null;
      serialNumber?: string | null;
    },
  ) {
    const task = await tx.task.findFirst({
      where: { orderId: input.orderId },
      select: { id: true },
    });
    if (!task) return null;

    return tx.task.update({
      where: { id: task.id },
      data: {
        title: buildShopLeadTaskTitle(input.orderId, input.productName),
        comment: buildShopLeadTaskComment({
          clientName: input.clientName,
          requestedPhone: input.requestedPhone,
          productName: input.productName,
          city: input.city,
          address: input.address,
          serialNumber: input.serialNumber,
        }),
        clientId: input.clientId,
      },
      select: { id: true },
    });
  }

  private describeCancellation(comment?: string | null) {
    if (String(comment || '').includes('[AUTO_RESERVE_EXPIRED]')) {
      return 'Не успел оплатить в течение 15 минут';
    }
    return null;
  }

  private async resolveQueueAssigneeId(preferredId?: number | null) {
    const preferred = Number(preferredId || 0);
    if (preferred > 0) {
      const preferredEmployee = await this.prisma.employee.findFirst({
        where: {
          id: preferred,
          tenant: 'TECHNOPRIME',
          isActive: true,
        },
        select: { id: true },
      });
      if (preferredEmployee) return preferredEmployee.id;
    }

    const dutyManager = await this.prisma.employee.findFirst({
      where: {
        tenant: 'TECHNOPRIME',
        role: { in: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] },
        isActive: true,
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    if (dutyManager) return dutyManager.id;

    const technician = await this.prisma.employee.findFirst({
      where: {
        tenant: 'TECHNOPRIME',
        role: 'TECHNICAL_SPECIALIST',
        isActive: true,
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    if (technician) return technician.id;

    const fallback = await this.prisma.employee.findFirst({
      where: {
        tenant: 'TECHNOPRIME',
        isActive: true,
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    if (!fallback) {
      throw new BadRequestException('Нет активных сотрудников для назначения');
    }

    return fallback.id;
  }

  /**
   * Архивируем только складские позиции (не карточки витрины), если они полностью проданы.
   * Для консолей это делаем автоматически при завершении сделки.
   * Для остальных категорий — только если у заказа явно включен archiveOnComplete.
   */
  private async archiveProductsAfterCompletion(
    tx: Prisma.TransactionClient,
    orderId: number,
  ): Promise<number> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        archiveOnComplete: true,
        items: {
          select: {
            productId: true,
          },
        },
      },
    });

    if (!order || !order.items.length) return 0;

    const productIds = Array.from(
      new Set(
        order.items.map(item => Number(item.productId)).filter(id => Number.isFinite(id) && id > 0),
      ),
    );
    if (!productIds.length) return 0;

    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        category: true,
        storefrontCategory: true,
        stock: true,
        isAlwaysAvailable: true,
        isActive: true,
      },
    });

    const idsToArchive = products
      .filter(product => {
        if (!product.isActive) return false;
        if (product.storefrontCategory) return false;
        if (product.isAlwaysAvailable) return false;

        const stock = Math.max(0, Number(product.stock || 0));
        if (stock > 0) return false;

        if (order.archiveOnComplete) return true;
        return product.category === 'CONSOLE';
      })
      .map(product => product.id);

    if (!idsToArchive.length) return 0;

    await tx.product.updateMany({
      where: { id: { in: idsToArchive } },
      data: {
        isActive: false,
        isArchived: true,
        archivedAt: new Date(),
      },
    });

    return idsToArchive.length;
  }

  // ✅ НОВЫЙ МЕТОД: синхронизация статуса заказа по статусу задач
  async syncOrderStatusFromTasks(orderId: number, actorId?: number | null): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, fulfillmentMethod: true },
    });

    if (!order) {
      return;
    }
    if (order.fulfillmentMethod === FulfillmentMethod.TRANSPORT_COMPANY) {
      return;
    }

    // Получаем все задачи для этого заказа
    const tasks = await this.prisma.task.findMany({
      where: { orderId },
      select: { id: true, status: true },
    });

    if (tasks.length === 0) {
      return;
    }

    // Проверяем статусы всех задач
    const allDone = tasks.every(t => t.status === TaskStatus.DONE);
    const anyInProgress = tasks.some(t => t.status === TaskStatus.IN_PROGRESS);

    let newOrderStatus = order.status;

    // Логика: если ВСЕ задачи DONE → заказ COMPLETED
    if (allDone && order.status !== OrderStatus.COMPLETED) {
      newOrderStatus = OrderStatus.COMPLETED;
    }
    // Если есть IN_PROGRESS → заказ IN_PROGRESS
    else if (
      anyInProgress &&
      order.status !== OrderStatus.IN_PROGRESS &&
      order.status !== OrderStatus.COMPLETED
    ) {
      newOrderStatus = OrderStatus.IN_PROGRESS;
    }

    // Если статус изменился → обновляем заказ
    if (newOrderStatus !== order.status) {
      await this.prisma.$transaction(async tx => {
        await tx.order.update({
          where: { id: orderId },
          data: { status: newOrderStatus },
        });

        if (newOrderStatus === OrderStatus.COMPLETED) {
          const fresh = await tx.order.findUnique({
            where: { id: orderId },
            select: { source: true },
          });
          if (fresh?.source === OrderSource.STORE) {
            await this.inventory.finalizeReservedOrderUnits(tx, orderId);
          }
          await this.archiveProductsAfterCompletion(tx, orderId);
        }
      });

      await this.writeAuditLog(
        actorId || undefined,
        'ORDER_STATUS_CHANGED',
        'ORDER',
        orderId,
        {
          status: newOrderStatus,
          viaTaskSync: true,
        },
        {
          status: order.status,
        },
      );

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

    const [rawItems, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          date: true,
          status: true,
          source: true,
          reserveUntil: true,
          totalPrice: true,
          comment: true,
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

    const completedByMap = await this.buildCompletedByMap(rawItems.map(item => item.id));

    const items = rawItems.map(item => ({
      ...item,
      completedBy: completedByMap.get(item.id) || null,
      isShopLead: this.isShopLeadComment(item.comment),
      leadStage: this.isShopLeadComment(item.comment) ? 'PREORDER' : null,
    }));

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
    const items = await this.prisma.order.findMany({
      where: { status: OrderStatus.NEW, managerId: null },
      select: {
        id: true,
        date: true,
        status: true,
        source: true,
        reserveUntil: true,
        totalPrice: true,
        comment: true,
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

    return items.map(item => ({
      ...item,
      isShopLead: this.isShopLeadComment(item.comment),
      leadStage: this.isShopLeadComment(item.comment) ? 'PREORDER' : null,
    }));
  }

  async sendLeadToTasks(orderId: number, actorId?: number | null) {
    if (!orderId || Number.isNaN(orderId)) {
      throw new BadRequestException('orderId is required');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        source: true,
        comment: true,
        clientId: true,
        managerId: true,
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
          select: {
            id: true,
            productId: true,
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            inventoryUnits: {
              select: {
                serialNumber: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException('Заказ не найден');
    }
    if (order.source !== OrderSource.STORE) {
      throw new BadRequestException('В задачи можно передать только заказ с сайта');
    }
    if (order.status !== OrderStatus.NEW) {
      throw new BadRequestException('В задачи можно передать только новый заказ');
    }

    const leadMeta = parseShopLeadComment(order.comment);
    const primary = this.getLeadPrimaryProduct(order);

    const existingTask = await this.prisma.task.findFirst({
      where: { orderId },
      select: { id: true },
    });
    if (existingTask) {
      return {
        success: true,
        orderId,
        taskId: existingTask.id,
        created: false,
      };
    }

    const managerId = Number(actorId || 0) || order.managerId || null;
    const assigneeId = await this.resolveQueueAssigneeId(managerId);

    const task = await this.prisma.$transaction(async tx => {
      if (managerId) {
        await tx.order.update({
          where: { id: orderId },
          data: { managerId },
        });
      }

      return tx.task.create({
        data: {
          title: this.isShopLeadComment(order.comment)
            ? buildShopLeadTaskTitle(order.id, primary.productName)
            : `Заказ #${order.id} • сайт`,
          comment: this.isShopLeadComment(order.comment)
            ? buildShopLeadTaskComment({
                clientName: order.client?.name || null,
                requestedPhone: leadMeta.requestedPhone || order.client?.phone || null,
                productName: primary.productName,
                city: leadMeta.city || order.client?.city || null,
                address: leadMeta.address || order.client?.address || null,
                serialNumber: primary.serialNumber || leadMeta.serialNumber,
              })
            : `${order.client?.name || ''} • ${order.client?.phone || ''}`.trim(),
          type: TaskType.OTHER,
          status: TaskStatus.NEW,
          orderId: order.id,
          clientId: order.clientId,
          assignedToId: assigneeId,
          dueDate: new Date(),
        },
        select: { id: true },
      });
    });

    await this.prisma.notification
      .create({
        data: {
          userId: assigneeId,
          type: 'ORDER_ASSIGNED',
          payload: {
            orderId: order.id,
            client: order.client?.name,
            queued: true,
            preorder: this.isShopLeadComment(order.comment),
          } as any,
        },
      })
      .catch(() => undefined);

    this.events.notifyUser(assigneeId, 'ORDER_ASSIGNED', {
      orderId: order.id,
      title: this.isShopLeadComment(order.comment)
        ? 'Предзаказ добавлен в задачи'
        : 'Заказ с сайта добавлен в задачи',
      text: `Заказ #${order.id} ждёт обработки`,
    });
    this.events.queueUpdated();

    await this.writeAuditLog(managerId || assigneeId, 'ORDER_SENT_TO_TASKS', 'ORDER', order.id, {
      managerId,
      assignedToId: assigneeId,
      taskId: task.id,
    });

    return {
      success: true,
      orderId,
      taskId: task.id,
      created: true,
    };
  }

  async getLeadInventoryOptions(orderId: number) {
    if (!orderId || Number.isNaN(orderId)) {
      throw new BadRequestException('orderId is required');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        source: true,
        comment: true,
        items: {
          select: {
            id: true,
            productId: true,
            variantKey: true,
          },
          take: 1,
        },
      },
    });

    if (!order) {
      throw new BadRequestException('Заказ не найден');
    }
    if (order.source !== OrderSource.STORE || !this.isShopLeadComment(order.comment)) {
      throw new BadRequestException('Опции склада доступны только для предзаказа с сайта');
    }

    const item = order.items[0];
    if (!item) {
      return { success: true, items: [] };
    }

    const items = await this.inventory.listAvailableForStoreProduct({
      productId: item.productId,
      variantKey: item.variantKey,
      limit: 50,
    });

    return {
      success: true,
      items,
    };
  }

  async updateLead(
    orderId: number,
    input: {
      name?: string;
      phone?: string;
      city?: string | null;
      address?: string | null;
      comment?: string | null;
      inventoryUnitId?: number | null;
    },
    actorId?: number | null,
  ) {
    if (!orderId || Number.isNaN(orderId)) {
      throw new BadRequestException('orderId is required');
    }

    const current = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        source: true,
        comment: true,
        clientId: true,
        totalPrice: true,
        shopCustomerId: true,
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
          select: {
            id: true,
            productId: true,
            variantKey: true,
            unitPrice: true,
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            inventoryUnits: {
              select: {
                id: true,
                serialNumber: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!current) {
      throw new BadRequestException('Заказ не найден');
    }
    if (current.source !== OrderSource.STORE || !this.isShopLeadComment(current.comment)) {
      throw new BadRequestException('Редактирование доступно только для предзаказа с сайта');
    }
    if (current.status !== OrderStatus.NEW) {
      throw new BadRequestException('Редактировать можно только новый предзаказ');
    }

    const item = current.items[0];
    if (!item) {
      throw new BadRequestException('В предзаказе нет товара');
    }

    const leadMeta = parseShopLeadComment(current.comment);
    const accountCustomer = current.shopCustomerId
      ? await this.prisma.shopCustomer.findUnique({
          where: { id: current.shopCustomerId },
          select: { phone: true },
        })
      : null;

    const hasName = input.name !== undefined;
    const hasCity = input.city !== undefined;
    const hasAddress = input.address !== undefined;
    const hasComment = input.comment !== undefined;
    const hasInventoryUnitId = input.inventoryUnitId !== undefined;

    const requestedPhone = this.validateCustomerPhone(
      input.phone || leadMeta.requestedPhone || current.client?.phone || '',
    );
    const clientName = hasName
      ? this.normalizeText(input.name)
      : this.normalizeText(current.client?.name);
    const city = hasCity
      ? this.normalizeText(input.city)
      : this.normalizeText(leadMeta.city || current.client?.city);
    const address = hasAddress
      ? this.normalizeText(input.address)
      : this.normalizeText(leadMeta.address || current.client?.address);
    const customerComment = hasComment
      ? this.normalizeText(input.comment)
      : this.normalizeText(leadMeta.comment);

    const resolvedClient = await this.crmSync.upsertClientByPhone({
      phone: requestedPhone,
      name: clientName || current.client?.name || null,
      city,
      address,
    });

    if (!resolvedClient) {
      throw new BadRequestException('Не удалось обновить карточку клиента');
    }

    const currentReservedUnit = item.inventoryUnits[0] || null;
    const requestedInventoryUnitId = hasInventoryUnitId ? Number(input.inventoryUnitId || 0) : null;
    const shouldReplaceInventory =
      hasInventoryUnitId &&
      Number(currentReservedUnit?.id || 0) !== Number(requestedInventoryUnitId || 0);

    const updated = await this.prisma.$transaction(async tx => {
      let reservedUnitSerial =
        shouldReplaceInventory && !requestedInventoryUnitId
          ? null
          : currentReservedUnit?.serialNumber || leadMeta.serialNumber || null;

      if (shouldReplaceInventory) {
        await this.inventory.releaseOrderUnits(tx, orderId, 'RESERVED_ONLY');
        if (requestedInventoryUnitId && requestedInventoryUnitId > 0) {
          const reserved = await this.inventory.reserveSpecificUnit(tx, {
            inventoryUnitId: requestedInventoryUnitId,
            productId: item.productId,
            orderId,
            orderItemId: item.id,
            variantKey: item.variantKey,
            salePriceOverride: item.unitPrice,
          });
          reservedUnitSerial = reserved.serialNumber || null;
        }
      }

      const nextComment = formatShopLeadComment({
        product: `${item.product?.name || `Товар #${item.productId}`} (#${item.productId})`,
        price: `${new Decimal(current.totalPrice || 0).toFixed(2)} ₽`,
        requestedPhone,
        city,
        address,
        comment: customerComment,
        accountPhone: accountCustomer?.phone || leadMeta.accountPhone || null,
        serialNumber: reservedUnitSerial,
      });

      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          clientId: resolvedClient.id,
          comment: nextComment,
        },
        select: {
          id: true,
          clientId: true,
        },
      });

      await this.syncLeadTask(tx, {
        orderId,
        clientId: resolvedClient.id,
        clientName: resolvedClient.name,
        requestedPhone,
        productName: item.product?.name || null,
        city,
        address,
        serialNumber: reservedUnitSerial,
      });

      return order;
    });

    await this.writeAuditLog(
      actorId,
      'SHOP_LEAD_UPDATED',
      'ORDER',
      orderId,
      {
        clientId: updated.clientId,
        name: resolvedClient.name,
        phone: requestedPhone,
        city,
        address,
        comment: customerComment,
        inventoryUnitId: hasInventoryUnitId ? requestedInventoryUnitId || null : undefined,
      },
      {
        clientId: current.clientId,
        name: current.client?.name || null,
        phone: leadMeta.requestedPhone || current.client?.phone || null,
        city: leadMeta.city || current.client?.city || null,
        address: leadMeta.address || current.client?.address || null,
        comment: leadMeta.comment || null,
        inventoryUnitId: currentReservedUnit?.id || null,
      },
    );

    return this.findOne(orderId);
  }

  async extendReserve(orderId: number, minutes: number, actorId?: number | null) {
    if (!orderId || Number.isNaN(orderId)) {
      throw new BadRequestException('orderId is required');
    }

    const extension = Number(minutes);
    if (![15, 30].includes(extension)) {
      throw new BadRequestException('Можно продлить бронь только на 15 или 30 минут');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        source: true,
        status: true,
        reserveUntil: true,
      },
    });

    if (!order) {
      throw new BadRequestException('Заказ не найден');
    }
    if (order.source !== OrderSource.STORE) {
      throw new BadRequestException('Продлить бронь можно только у заказа с сайта');
    }
    if (order.status !== OrderStatus.NEW) {
      throw new BadRequestException('Продлить бронь можно только у нового заказа');
    }
    if (!order.reserveUntil) {
      throw new BadRequestException('У заказа нет активной брони');
    }

    const baseTime = Math.max(order.reserveUntil.getTime(), Date.now());
    const nextReserveUntil = new Date(baseTime + extension * 60 * 1000);

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        reserveUntil: nextReserveUntil,
      },
      select: {
        id: true,
        reserveUntil: true,
      },
    });

    await this.writeAuditLog(
      actorId,
      'ORDER_RESERVE_EXTENDED',
      'ORDER',
      orderId,
      {
        minutes: extension,
        reserveUntil: updated.reserveUntil?.toISOString() || null,
      },
      {
        reserveUntil: order.reserveUntil.toISOString(),
      },
    );

    return {
      success: true,
      orderId,
      reserveUntil: updated.reserveUntil,
      minutes: extension,
    };
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
        consoleType?: 'PS4' | 'PS5' | 'XBOX_1' | 'XBOX_2';
        emailLogin?: string;
        emailPassword?: string;
        accountPassword?: string;
      };
      salesChannel?: SalesChannel | string;
      fulfillmentMethod?: FulfillmentMethod | string;
      settlementStatus?: SettlementStatus | string;
      expectedPayout?: number | string | null;
      actualPayout?: number | string | null;
      marketplaceCommission?: number | string | null;
      shipment?: {
        carrier?: ShipmentCarrier | string;
        externalOrderNumber?: string;
        trackingNumber?: string;
        barcode?: string;
        senderPoint?: string;
        receiverPoint?: string;
        expectedDeliveryAt?: string | Date | null;
        managerComment?: string;
        customerNote?: string;
      };
    },
    createdById: number,
  ) {
    if (!dto.items?.length) throw new BadRequestException('Позиции заказа пусты');

    const fulfillmentMethod = this.enumValue(
      FulfillmentMethod,
      dto.fulfillmentMethod,
      FulfillmentMethod.LOCAL_DELIVERY,
    );
    const salesChannel = this.enumValue(SalesChannel, dto.salesChannel, SalesChannel.RETAIL);
    const isTransportOrder = fulfillmentMethod === FulfillmentMethod.TRANSPORT_COMPANY;
    const settlementStatus = isTransportOrder
      ? this.enumValue(
          SettlementStatus,
          dto.settlementStatus,
          SettlementStatus.AWAITING_CUSTOMER_RECEIPT,
        )
      : this.enumValue(SettlementStatus, dto.settlementStatus, SettlementStatus.NOT_REQUIRED);

    const created = await this.prisma.$transaction(async tx => {
      // ✅ 1. Создаём заказ
      const order = await tx.order.create({
        data: {
          clientId: dto.clientId,
          createdById,
          source: OrderSource.MANUAL,
          salesChannel,
          fulfillmentMethod,
          settlementStatus,
          expectedPayout: this.moneyOptional(dto.expectedPayout),
          actualPayout: this.moneyOptional(dto.actualPayout),
          marketplaceCommission: this.moneyOptional(dto.marketplaceCommission),
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
            storefrontCategory: true,
            isActive: true,
            isAlwaysAvailable: true,
            price: true,
            costPrice: true,
            serialNumber: true,
            category: true,
          },
        })) as any;

        if (!product) throw new BadRequestException(`Товар #${it.productId} не найден`);
        if (product.isActive === false)
          throw new BadRequestException(`Товар ${product.name} в архиве`);
        const availableUnits = product.isAlwaysAvailable
          ? Number.MAX_SAFE_INTEGER
          : await this.inventory.countAvailableUnitsForProduct(
              {
                productId: product.id,
              },
              tx,
            );
        if (availableUnits < qty) {
          throw new BadRequestException(
            `Недостаточно остатка по ${product.name} (доступно: ${availableUnits})`,
          );
        }

        const up = new Decimal(it.salePrice ?? product.price ?? 0);
        const uc = new Decimal(product.costPrice ?? 0);
        const lt = up.mul(qty);
        const lc = uc.mul(qty);

        const orderItem = await tx.orderItem.create({
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

        if (!product.isAlwaysAvailable) {
          await this.inventory.consumeAvailableUnits(tx, {
            productId: product.id,
            qty,
            orderId: order.id,
            orderItemId: orderItem.id,
            mode: isTransportOrder ? 'RESERVE' : 'SELL',
          });
        }

        if (!firstSerial) firstSerial = product.serialNumber || product.name || null;
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

      if (isTransportOrder) {
        const carrier = this.enumValue(
          ShipmentCarrier,
          dto.shipment?.carrier,
          ShipmentCarrier.OTHER,
        );
        const shipmentStatus =
          dto.shipment?.externalOrderNumber ||
          dto.shipment?.trackingNumber ||
          dto.shipment?.barcode ||
          dto.shipment?.receiverPoint
            ? ShipmentStatus.READY_FOR_HANDOVER
            : ShipmentStatus.AWAITING_SHIPMENT_DATA;

        const shipment = await tx.shipment.create({
          data: {
            orderId: order.id,
            carrier,
            status: shipmentStatus,
            externalOrderNumber: this.normalizeText(dto.shipment?.externalOrderNumber),
            trackingNumber: this.normalizeText(dto.shipment?.trackingNumber),
            barcode: this.normalizeText(dto.shipment?.barcode),
            senderPoint: this.normalizeText(dto.shipment?.senderPoint),
            receiverPoint: this.normalizeText(dto.shipment?.receiverPoint),
            expectedDeliveryAt: this.parseDate(dto.shipment?.expectedDeliveryAt),
            managerComment: this.normalizeText(dto.shipment?.managerComment),
            customerNote: this.normalizeText(dto.shipment?.customerNote),
          },
        });

        await tx.inventoryUnit.updateMany({
          where: {
            orderId: order.id,
            status: InventoryUnitStatus.RESERVED,
          },
          data: { status: InventoryUnitStatus.HANDOVER_PENDING },
        });

        await tx.shipmentEvent.create({
          data: {
            shipmentId: shipment.id,
            status: shipmentStatus,
            source: ShipmentSyncMode.MANUAL,
            title:
              shipmentStatus === ShipmentStatus.READY_FOR_HANDOVER
                ? 'Готов к передаче в службу доставки'
                : 'Ожидает данных отправки',
            comment: 'Отправление создано из ручного заказа',
            createdById,
          },
        });
      }

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
              endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
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
              accountType: dto.subscription.accountType || AccountType.PERSONAL,
              subscriptionPeriod: dto.subscription.subscriptionPeriod || SubscriptionPeriod.MONTH,
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

      // ✅ 5. Стартовая ответственность за задачу — создатель заказа.
      // Задача переходит конкретному исполнителю только после явного принятия (админ/техник).
      const assigneeDefaultId = createdById;

      // ✅ 6. Создаём задачу
      try {
        const task = await tx.task.create({
          data: {
            title: isTransportOrder
              ? `Логистика по заказу #${order.id}${firstSerial ? ` • ${firstSerial}` : ''}`
              : `Заказ #${order.id}${firstSerial ? ` • ${firstSerial}` : ''}`,
            comment: isTransportOrder
              ? `${order.client?.name || ''} • ${order.client?.phone || ''}\nПодготовить отправление и передать товар в службу доставки.`
              : `${order.client?.name || ''} • ${order.client?.phone || ''}`,
            type: isTransportOrder ? TaskType.LOGISTICS : TaskType.OTHER,
            status: TaskStatus.NEW,
            orderId: order.id,
            clientId: order.clientId,
            assignedToId: assigneeDefaultId,
            dueDate: new Date(),
          },
        });
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

    await this.writeAuditLog(createdById, 'ORDER_CREATED', 'ORDER', created.id, {
      clientId: created.clientId,
      status: created.status,
      source: created.source,
      totalPrice: created.totalPrice,
    });

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

    const currentOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, managerId: true },
    });
    if (!currentOrder) {
      throw new BadRequestException('Заказ не найден');
    }

    const employeeId = await this.resolveQueueAssigneeId(Number(assigneeId || 0));

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

    const task = await this.prisma.task.findFirst({
      where: { orderId },
      select: {
        id: true,
        status: true,
        acceptedById: true,
      },
    });

    if (task) {
      const updateTaskData: any = {
        status: TaskStatus.IN_PROGRESS,
        assignedToId: employeeId,
      };

      if (!task.acceptedById || task.status === TaskStatus.NEW) {
        updateTaskData.acceptedById = employeeId;
        updateTaskData.acceptedAt = new Date();
      }

      await this.prisma.task.update({
        where: { id: task.id },
        data: updateTaskData,
      });
    } else {
      const createdTask = await this.prisma.task.create({
        data: {
          title: `Заказ #${order.id}`,
          comment: `${order.client?.name || ''} • ${order.client?.phone || ''}`.trim(),
          type: TaskType.OTHER,
          status: TaskStatus.IN_PROGRESS,
          orderId: order.id,
          clientId: order.client?.id || undefined,
          assignedToId: employeeId,
          dueDate: new Date(),
        },
        select: { id: true },
      });
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

    await this.writeAuditLog(
      employeeId,
      'ORDER_STATUS_CHANGED',
      'ORDER',
      order.id,
      {
        status: order.status,
        managerId: order.managerId,
        assigned: true,
      },
      {
        status: currentOrder.status,
        managerId: currentOrder.managerId,
      },
    );

    return order;
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
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
            inventoryUnits: {
              select: {
                id: true,
                serialNumber: true,
                salePrice: true,
                previousSalePrice: true,
              },
            },
          },
        },
      },
    });

    if (!order) return null;

    const leadInfo = parseShopLeadComment(order.comment);
    const completedByMap = await this.buildCompletedByMap([order.id]);

    return {
      ...order,
      completedBy: completedByMap.get(order.id) || null,
      leadInfo: leadInfo.isShopLead ? leadInfo : null,
      cancellationReason: this.describeCancellation(order.comment),
      items: order.items.map(item => ({
        ...item,
        serialNumber:
          item.inventoryUnits.find(unit => unit.serialNumber)?.serialNumber ||
          item.product?.serialNumber ||
          null,
      })),
    };
  }

  private async buildCompletedByMap(orderIds: number[]) {
    const uniqueIds = Array.from(new Set(orderIds.map(id => Number(id)).filter(id => id > 0)));
    if (!uniqueIds.length)
      return new Map<number, { id: number; name: string; role?: Role | null }>();

    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: 'ORDER_STATUS_CHANGED',
        entityType: 'ORDER',
        entityId: { in: uniqueIds },
      },
      orderBy: [{ entityId: 'asc' }, { createdAt: 'desc' }],
      select: {
        entityId: true,
        userId: true,
        newData: true,
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    const map = new Map<number, { id: number; name: string; role?: Role | null }>();

    for (const log of logs) {
      if (!log.entityId || !log.userId || map.has(log.entityId)) continue;
      const nextStatus = String((log.newData as any)?.status || '').toUpperCase();
      if (nextStatus !== 'COMPLETED') continue;

      map.set(log.entityId, {
        id: log.user?.id || log.userId,
        name: log.user?.name || 'Сотрудник',
        role: log.user?.role || null,
      });
    }

    return map;
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
    const currentOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, source: true, fulfillmentMethod: true },
    });
    if (!currentOrder) {
      throw new BadRequestException('Заказ не найден');
    }

    const st = OrderStatus[status] ?? OrderStatus.NEW;

    const updateData: any = {
      status: st,
      archiveOnComplete: archiveOnComplete ?? undefined,
    };

    if (st === OrderStatus.COMPLETED && managerId && managerId > 0) {
      updateData.managerId = managerId;
      if (currentOrder.fulfillmentMethod === FulfillmentMethod.TRANSPORT_COMPANY) {
        updateData.settlementStatus = SettlementStatus.FUNDS_RECEIVED;
      }
    }

    const order = await this.prisma.$transaction(async tx => {
      const updated = await tx.order.update({
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

      if (currentOrder.source === OrderSource.STORE) {
        if (st === OrderStatus.COMPLETED && currentOrder.status !== OrderStatus.COMPLETED) {
          await this.inventory.finalizeReservedOrderUnits(tx, orderId);
        } else if (st === OrderStatus.CANCELED) {
          await this.inventory.releaseOrderUnits(tx, orderId, 'RESERVED_ONLY');
          await tx.task.deleteMany({
            where: {
              orderId,
            },
          });
        }
      } else if (
        currentOrder.fulfillmentMethod === FulfillmentMethod.TRANSPORT_COMPANY &&
        st === OrderStatus.COMPLETED
      ) {
        await tx.inventoryUnit.updateMany({
          where: {
            tenant: 'TECHNOPRIME',
            orderId,
            status: {
              in: [
                InventoryUnitStatus.RESERVED,
                InventoryUnitStatus.HANDOVER_PENDING,
                InventoryUnitStatus.IN_TRANSIT,
                InventoryUnitStatus.DELIVERED,
              ],
            },
          },
          data: {
            status: InventoryUnitStatus.SOLD,
            soldAt: new Date(),
          },
        });
      }

      if (st === OrderStatus.COMPLETED) {
        await this.archiveProductsAfterCompletion(tx, orderId);
      }

      return updated;
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

    await this.writeAuditLog(
      managerId,
      'ORDER_STATUS_CHANGED',
      'ORDER',
      order.id,
      {
        status: st,
        archiveOnComplete: order.archiveOnComplete,
        managerId: order.managerId,
      },
      {
        status: currentOrder.status,
        source: currentOrder.source,
      },
    );

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
    if (order?.managerId && order.managerId !== authorId) targets.add(order.managerId);
    if (order?.createdById && order.createdById !== authorId) targets.add(order.createdById);

    if (targets.size) {
      await this.prisma.$transaction(
        Array.from(targets).map(uid =>
          this.prisma.notification.create({
            data: {
              userId: uid,
              type: 'ORDER_COMMENT',
              payload: { orderId, commentId: comment.id } as any,
            },
          }),
        ),
      );
      Array.from(targets).forEach(uid =>
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
      throw new BadRequestException('Только администратор может удалять заказы');
    }

    return this.prisma.$transaction(async tx => {
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

      await this.inventory.releaseOrderUnits(tx, orderId, 'ANY_SOLD_OR_RESERVED');

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
        message: 'Заказ удалён, складские единицы возвращены в доступные, подписки отменены',
      };
    });
  }
}
