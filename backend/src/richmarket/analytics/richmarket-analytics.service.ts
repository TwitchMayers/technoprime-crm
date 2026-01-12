import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Tenant, OrderStatus } from '@prisma/client';

@Injectable()
export class RichMarketAnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardData(period: string = 'week') {
    const dateFilter = this.getDateFilter(period);
    
    const [
      totalOrders,
      completedOrders,
      totalClients,
      revenueData,
      profitData
    ] = await Promise.all([
      // Все заказы
      this.prisma.richMarketOrder.count({
        where: { 
          tenant: Tenant.RICHMARKET,
          ...dateFilter
        },
      }),
      
      // Только завершенные заказы
      this.prisma.richMarketOrder.findMany({
        where: { 
          tenant: Tenant.RICHMARKET,
          status: OrderStatus.COMPLETED,
          ...dateFilter
        },
      }),
      
      // Клиенты
      this.prisma.richMarketClient.count({
        where: { tenant: Tenant.RICHMARKET },
      }),
      
      // Выручка
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
      
      // Прибыль
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

    const revenue = revenueData._sum.totalPrice || 0;
    const profit = profitData._sum.profit || 0;
    const averageOrder = completedOrders.length > 0 ? Number(revenue) / completedOrders.length : 0;

    return {
      revenue: Number(revenue),
      profit: Number(profit),
      orders: totalOrders,
      clients: totalClients,
      items: await this.getTotalStock(),
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

    // Группируем по дням
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

    const statusColors: { [key: string]: string } = {
      'NEW': '#3b82f6',
      'IN_PROGRESS': '#f59e0b',
      'COMPLETED': '#10b981',
      'CANCELLED': '#ef4444',
    };

    return statusCounts.map(item => ({
      name: item.status,
      value: item._count.id,
      color: statusColors[item.status] || '#6b7280',
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

    const deliveryColors: { [key: string]: string } = {
      'СДЭК': '#8b5cf6',
      'Почта России': '#f59e0b',
      'Яндекс Доставка': '#f97316',
      'Boxberry': '#ec4899',
      'Авито Доставка': '#06b6d4',
    };

    return deliveryCounts.map(item => ({
      name: item.deliveryService || 'Не указано',
      value: item._count.id,
      color: item.deliveryService ? (deliveryColors[item.deliveryService] || '#6b7280') : '#6b7280',
    }));
  }

  async getTopProducts(limit: number = 5) {
    const orders = await this.prisma.richMarketOrder.findMany({
      where: { tenant: Tenant.RICHMARKET },
      include: {
        items: {
          include: { product: true },
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
        client: { select: { name: true } as any },
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

  private async getTotalStock(): Promise<number> {
    const products = await this.prisma.richMarketProduct.findMany({
      where: { 
        tenant: Tenant.RICHMARKET,
        isActive: false 
      },
      include: { sizes: true },
    });

    return products.reduce((total, product) => {
      return total + product.sizes.reduce((sizeTotal, size) => {
        return sizeTotal + size.stock;
      }, 0);
    }, 0);
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