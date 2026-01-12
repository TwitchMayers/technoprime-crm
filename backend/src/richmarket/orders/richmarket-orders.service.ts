import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Tenant, OrderStatus, TaskStatus, TaskType, PaymentMethod, ClothingSize } from '@prisma/client';
import { EventsService } from '../../events/events.service';


@Injectable()
export class RichMarketOrdersService {
  constructor(
    private prisma: PrismaService,
    private events: EventsService,
  ) {}

  async list(params?: { status?: string; managerId?: string; q?: string }) {
    const where: any = { tenant: Tenant.RICHMARKET };
    
    if (params?.status) {
      where.status = params.status.toUpperCase() as OrderStatus;
    }
    
    if (params?.managerId) {
      where.managerId = Number(params.managerId);
    }
    
    if (params?.q) {
      where.client = {
        OR: [
          { name: { contains: params.q, mode: 'insensitive' } },
          { phone: { contains: params.q, mode: 'insensitive' } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.richMarketOrder.findMany({
        where,
        include: {  
          client: true,
          manager: { select: { id: true, name: true } },
          items: { 
            include: {  
              product: {
                include: {
                  sizes: true,
                },
              },
            } 
          },
        },
        orderBy: { id: 'desc' },
        take: 100,
      }),
      this.prisma.richMarketOrder.count({ where }),
    ]);

    return { items, total };
  }

  async create(dto: {
    clientId: number;
    paymentMethod: string;
    deliveryService?: string;
    trackingCode?: string;
    deliveryAddress?: string;
    comment?: string;
    items: { productId: number; size: string; qty: number; salePrice: number }[];
  }, createdById: number) {
    
    if (!dto.items?.length) {
      throw new BadRequestException('Добавьте товары');
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.richMarketOrder.create({
        data: {
          tenant: Tenant.RICHMARKET,
          clientId: dto.clientId,
          createdById,
          paymentMethod: dto.paymentMethod as PaymentMethod,
          deliveryService: dto.deliveryService as any,
          trackingCode: dto.trackingCode,
          deliveryAddress: dto.deliveryAddress,
          comment: dto.comment,
          status: OrderStatus.NEW,
          totalPrice: 0,
          costPrice: 0,
          profit: 0,
        },
        include: { client: true },
      });

      let totalSale = 0;
      let totalCost = 0;
      let firstItemInfo = '';

      for (const it of dto.items) {
        const product = await tx.richMarketProduct.findUnique({ 
          where: { id: it.productId },
          include: { sizes: true },
        });
        
        if (!product) {
          throw new BadRequestException(`Товар #${it.productId} не найден`);
        }

        const sizeData = product.sizes.find(s => s.size === it.size);

        if (!sizeData) {
          throw new BadRequestException(`Размер ${it.size} не найден для товара ${product.brand}`);
        }

        if (sizeData.stock < it.qty) {
          throw new BadRequestException(
            `Недостаточно товара: ${product.brand} ${product.category} ${sizeData.size} (доступно: ${sizeData.stock})`
          );
        }

        const lineTotal = it.salePrice * it.qty;
        const lineCost = Number(product.costPrice) * it.qty;

        await tx.richMarketOrderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            size: sizeData.size as ClothingSize,
            qty: it.qty,
            unitPrice: it.salePrice,
            unitCost: Number(product.costPrice),
            lineTotal,
            lineCost,
          },
        });

        await tx.richMarketProductSize.update({
          where: { id: sizeData.id },
          data: { stock: sizeData.stock - it.qty },
        });

        if (!firstItemInfo) {
          firstItemInfo = `${product.brand} (${product.color})`;
        }

        totalSale += lineTotal;
        totalCost += lineCost;
      }

      await tx.richMarketOrder.update({
        where: { id: order.id },
        data: {
          totalPrice: totalSale,
          costPrice: totalCost,
          profit: totalSale - totalCost,
        },
      });

      await tx.richMarketTask.create({
        data: {
          tenant: Tenant.RICHMARKET,
          title: `Заказ #${order.id} - ${firstItemInfo}`,
          comment: `Клиент: ${order.client?.name}\nДоставка: ${dto.deliveryService || 'Самовывоз'}\nТрек: ${dto.trackingCode || '—'}`,
          type: TaskType.DELIVERY,
          status: TaskStatus.NEW,
          orderId: order.id,
          clientId: order.clientId,
          assignedToId: createdById,
          dueDate: new Date(),
        },
      });

      this.events.broadcast('ORDER_CREATED', {
        orderId: order.id,
        title: 'Новый заказ RichMarket!',
        text: `Заказ #${order.id}`,
        tenant: 'RICHMARKET',
      });

      return order;
    });
  }

  async delete(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.richMarketOrder.findUnique({
        where: { id },
        include: {   
          items: { 
            include: { 
              product: {
                include: { sizes: true }
              }
            } 
          } 
        },
      });

      if (!order) throw new BadRequestException('Заказ не найден');

      for (const item of order.items) {
        const productSize = item.product.sizes.find(s => s.size === item.size);
        if (productSize) {
          await tx.richMarketProductSize.update({
            where: { id: productSize.id },
            data: { stock: productSize.stock + item.qty },
          });
        }
      }

      await tx.richMarketOrderItem.deleteMany({ where: { orderId: id } });
      await tx.richMarketTask.deleteMany({ where: { orderId: id } });
      await tx.richMarketOrderComment.deleteMany({ where: { orderId: id } });
      await tx.richMarketOrder.delete({ where: { id } });

      return { success: true };
    });
  }

  async assign(orderId: number, assigneeId: number) {
    const order = await this.prisma.richMarketOrder.update({
      where: { id: orderId },
      data: { 
        managerId: assigneeId, 
        status: OrderStatus.IN_PROGRESS 
      },
      include: { client: true },
    });

    const task = await this.prisma.richMarketTask.findFirst({ 
      where: { orderId } 
    });

    if (task) {
      await this.prisma.richMarketTask.update({
        where: { id: task.id },
        data: { 
          status: TaskStatus.IN_PROGRESS, 
          assignedToId: assigneeId 
        },
      });
    }

    this.events.queueUpdated();
    return order;
  }

  async complete(orderId: number) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.richMarketOrder.findUnique({
        where: { id: orderId },
        include: {  
          items: {
            include: {
              product: true
            }
          }
        }
      });

      if (!order) {
        throw new BadRequestException('Заказ не найден');
      }

      // Обновляем статус заказа
      const updatedOrder = await tx.richMarketOrder.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED },
      });

      const task = await tx.richMarketTask.findFirst({ 
        where: { orderId } 
      });

      if (task) {
        await tx.richMarketTask.update({
          where: { id: task.id },
          data: { status: TaskStatus.DONE },
        });
      }

      this.events.queueUpdated();
      return updatedOrder;
    });
  }

  // ✅ ДОБАВЛЯЕМ МЕТОДЫ АНАЛИТИКИ
  async getDashboardAnalytics(period: string = 'week') {
    const dateFilter = this.getDateFilter(period);
    
    const [
      totalOrders,
      completedOrders,
      totalClients,
      revenueData,
      profitData
    ] = await Promise.all([
      this.prisma.richMarketOrder.count({
        where: { 
          tenant: Tenant.RICHMARKET,
          ...dateFilter
        },
      }),
      
      this.prisma.richMarketOrder.findMany({
        where: { 
          tenant: Tenant.RICHMARKET,
          status: OrderStatus.COMPLETED,
          ...dateFilter
        },
      }),
      
      this.prisma.richMarketClient.count({
        where: { tenant: Tenant.RICHMARKET },
      }),
      
      this.prisma.richMarketOrder.aggregate({
        where: { 
          tenant: Tenant.RICHMARKET,
          status: OrderStatus.COMPLETED,
          ...dateFilter
        },
        _sum: {
          totalPrice: true,
        },
      }),
      
      this.prisma.richMarketOrder.aggregate({
        where: { 
          tenant: Tenant.RICHMARKET,
          status: OrderStatus.COMPLETED,
          ...dateFilter
        },
        _sum: {
          profit: true,
        },
      }),
    ]);

    const revenue = Number(revenueData._sum.totalPrice || 0);
    const profit = Number(profitData._sum.profit || 0);
    const averageOrder = completedOrders.length > 0 ? revenue / completedOrders.length : 0;

    // Получаем общее количество товаров на складе
    const products = await this.prisma.richMarketProduct.findMany({
      where: { 
        tenant: Tenant.RICHMARKET,
        isActive: true 
      },
      include: { sizes: true },
    });

    const totalStock = products.reduce((total, product) => {
      return total + product.sizes.reduce((sizeTotal, size) => {
        return sizeTotal + size.stock;
      }, 0);
    }, 0);

    return {
      revenue: revenue,
      profit: profit,
      orders: totalOrders,
      clients: totalClients,
      items: totalStock,
      averageOrder: Number(averageOrder),
    };
  }

  async getSalesTrend(period: string = 'week') {
    const dateFilter = this.getDateFilter(period);
    
    const orders = await this.prisma.richMarketOrder.findMany({
      where: {
        tenant: Tenant.RICHMARKET,
        status: OrderStatus.COMPLETED,
        ...dateFilter
      },
      select: {
        date: true,
        totalPrice: true,
        profit: true,
      },
      orderBy: { date: 'asc' },
    });

    const dailyData = orders.reduce((acc: any, order) => {
      const date = order.date.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          revenue: 0,
          profit: 0,
          orders: 0,
        };
      }
      acc[date].revenue += Number(order.totalPrice);
      acc[date].profit += Number(order.profit);
      acc[date].orders += 1;
      return acc;
    }, {});

    return Object.values(dailyData).map((item: any) => ({
      date: new Date(item.date).toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'short' 
      }),
      revenue: item.revenue,
      profit: item.profit,
      orders: item.orders,
    }));
  }

  async getOrdersByStatus() {
    const statusCounts = await this.prisma.richMarketOrder.groupBy({
      by: ['status'],
      where: { tenant: Tenant.RICHMARKET },
      _count: { id: true },
    });

    type OrderStatusType = 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
    const statusColors: Record<OrderStatusType, string> = {
      'NEW': '#3b82f6',
      'IN_PROGRESS': '#f59e0b',
      'COMPLETED': '#10b981',
      'CANCELED': '#ef4444',
    };

    return statusCounts.map(item => ({
      name: item.status,
      value: item._count.id,
      color: statusColors[item.status as OrderStatusType] || '#6b7280',
    }));
  }

  async getDeliveryMethods() {
    const deliveryCounts = await this.prisma.richMarketOrder.groupBy({
      by: ['deliveryService'],
      where: { 
        tenant: Tenant.RICHMARKET,
        deliveryService: { not: null }
      },
      _count: { id: true },
    });

    return deliveryCounts.map(item => ({
      name: item.deliveryService || 'Не указано',
      value: item._count.id,
      color: '#6b7280',
    }));
  }

  async getTopProducts(limit: number = 5) {
    const orders = await this.prisma.richMarketOrder.findMany({
      where: { tenant: Tenant.RICHMARKET },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      take: limit * 2,
    });

    const productMap = new Map();
    for (const order of orders) {
      for (const item of order.items) {
        const key = `${item.productId}`;
        if (!productMap.has(key)) {
          productMap.set(key, {
            id: item.productId,
            brand: item.product.brand,
            category: item.product.category,
            color: item.product.color,
            sales: 0,
            revenue: 0,
          });
        }
        const product = productMap.get(key);
        product.sales += item.qty;
        product.revenue += Number(item.lineTotal);
      }
    }

    return Array.from(productMap.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, limit)
      .map((product, index) => ({
        ...product,
        trend: index === 0 ? 12 : index === 1 ? -5 : index === 2 ? 8 : 3,
      }));
  }

  async getRecentActivity(limit: number = 4) {
    const orders = await this.prisma.richMarketOrder.findMany({
      where: { tenant: Tenant.RICHMARKET },
      include: {  
        client: { select: { name: true } },
        items: {
          include: {
            product: { select: { brand: true, category: true } }
          },
          take: 1,
        },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });

    return orders;
  }

  private getDateFilter(period: string) {
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    return {
      date: {
        gte: startDate,
        lte: now,
      },
    };
  }
}