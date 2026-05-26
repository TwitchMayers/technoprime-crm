import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrderStatus } from '@prisma/client';
import Decimal from 'decimal.js';

function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0));
}
function endOfDay(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59));
}

function rangeOrDefault(from?: string, to?: string) {
  if (from && to) return { from: startOfDay(new Date(from)), to: endOfDay(new Date(to)) };
  const now = new Date();
  const fromDef = new Date(now);
  fromDef.setDate(fromDef.getDate() - 6);
  return { from: startOfDay(fromDef), to: endOfDay(now) };
}

@Injectable()
export class AnalyticsService {
  private readonly cacheTtlMs = 30_000;
  private readonly requestCache = new Map<
    string,
    { expiresAt: number; value?: any; promise?: Promise<any> }
  >();

  constructor(private prisma: PrismaService) {}

  private d(v: any) {
    return new Decimal(v || 0);
  }
  private n(d: Decimal) {
    return Number(d.toFixed(2));
  }
  private cacheKey(scope: string, parts: Array<string | number | undefined>) {
    return `${scope}:${parts.map(part => String(part ?? '')).join(':')}`;
  }

  private async withCache<T>(
    key: string,
    loader: () => Promise<T>,
    ttlMs = this.cacheTtlMs,
  ): Promise<T> {
    const cached = this.requestCache.get(key);
    if (cached?.value !== undefined && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
    if (cached?.promise) {
      return cached.promise as Promise<T>;
    }

    const promise = loader()
      .then(value => {
        this.requestCache.set(key, {
          expiresAt: Date.now() + ttlMs,
          value,
        });
        return value;
      })
      .finally(() => {
        const current = this.requestCache.get(key);
        if (current?.promise) {
          this.requestCache.delete(key);
        }
      });

    this.requestCache.set(key, {
      expiresAt: 0,
      promise,
    });

    return promise;
  }

  async overview(from?: string, to?: string) {
    const key = this.cacheKey('overview', [from, to]);
    return this.withCache(key, async () => {
      const { from: gte, to: lte } = rangeOrDefault(from, to);

      const orders = await this.prisma.order.findMany({
        where: { status: OrderStatus.COMPLETED, date: { gte, lte } },
        select: {
          id: true,
          date: true,
          items: {
            select: {
              lineTotal: true,
              lineCost: true,
            },
          },
        },
        orderBy: { date: 'asc' },
      });

      let revenue = this.d(0),
        cost = this.d(0);
      const byDay = new Map<string, { rev: Decimal; cost: Decimal }>();

      for (const o of orders) {
        const key = startOfDay(o.date).toISOString().slice(0, 10);
        if (!byDay.has(key)) byDay.set(key, { rev: this.d(0), cost: this.d(0) });
        for (const it of o.items) {
          const lt = this.d(it.lineTotal);
          const lc = this.d(it.lineCost);
          revenue = revenue.add(lt);
          cost = cost.add(lc);
          const agg = byDay.get(key)!;
          agg.rev = agg.rev.add(lt);
          agg.cost = agg.cost.add(lc);
        }
      }
      const profit = revenue.sub(cost);

      const adSpends = await this.prisma.adSpend.findMany({
        where: { date: { gte, lte } },
        orderBy: { date: 'asc' },
      });
      let adTotal = this.d(0);
      const adByDay = new Map<string, Decimal>();
      for (const a of adSpends) {
        const key = startOfDay(a.date).toISOString().slice(0, 10);
        adTotal = adTotal.add(this.d(a.amount));
        adByDay.set(key, (adByDay.get(key) || this.d(0)).add(this.d(a.amount)));
      }

      const seriesByDay: any[] = [];
      for (let d = new Date(gte); d <= lte; d.setDate(d.getDate() + 1)) {
        const key = startOfDay(d).toISOString().slice(0, 10);
        const s = byDay.get(key) || { rev: this.d(0), cost: this.d(0) };
        const ad = adByDay.get(key) || this.d(0);
        const prof = s.rev.sub(s.cost);
        const net = prof.sub(ad);
        seriesByDay.push({
          date: key,
          revenue: this.n(s.rev),
          cost: this.n(s.cost),
          profit: this.n(prof),
          adSpend: this.n(ad),
          netProfit: this.n(net),
        });
      }

      const totals = {
        ordersClosed: orders.length,
        revenue: this.n(revenue),
        cost: this.n(cost),
        profit: this.n(profit),
        adSpend: this.n(adTotal),
        netProfit: this.n(profit.sub(adTotal)),
      };

      return { totals, seriesByDay };
    });
  }

  async employees(from?: string, to?: string) {
    const key = this.cacheKey('employees', [from, to]);
    return this.withCache(key, async () => {
      const { from: gte, to: lte } = rangeOrDefault(from, to);
      const orders = await this.prisma.order.findMany({
        where: { status: OrderStatus.COMPLETED, date: { gte, lte } },
        select: {
          managerId: true,
          manager: {
            select: {
              id: true,
              name: true,
              login: true,
            },
          },
          items: {
            select: {
              lineTotal: true,
              lineCost: true,
            },
          },
        },
      });

      const map = new Map<
        number,
        { name: string; closedCount: number; revenue: Decimal; cost: Decimal }
      >();
      for (const o of orders) {
        const mid = o.managerId ?? 0;
        const login = String(o.manager?.login || '').toLowerCase();
        const nameLc = String(o.manager?.name || '').toLowerCase();
        if (
          login === 'alexey' ||
          login === 'alexander' ||
          login === 'luka' ||
          nameLc === 'алексей мураитов' ||
          nameLc === 'александр ануфриев' ||
          nameLc === 'иван лукашин'
        ) {
          continue;
        }
        const name = o.manager?.name || (mid ? `#${mid}` : '—');
        if (!map.has(mid))
          map.set(mid, { name, closedCount: 0, revenue: this.d(0), cost: this.d(0) });
        const agg = map.get(mid)!;
        agg.closedCount += 1;
        for (const it of o.items) {
          agg.revenue = agg.revenue.add(this.d(it.lineTotal));
          agg.cost = agg.cost.add(this.d(it.lineCost));
        }
      }

      return Array.from(map.entries()).map(([employeeId, v]) => ({
        employeeId,
        name: v.name,
        closedCount: v.closedCount,
        revenue: this.n(v.revenue),
        cost: this.n(v.cost),
        profit: this.n(v.revenue.sub(v.cost)),
        avgCheck: v.closedCount ? this.n(v.revenue.div(v.closedCount)) : 0,
      }));
    });
  }

  async salesByAds(from?: string, to?: string) {
    const key = this.cacheKey('salesByAds', [from, to]);
    return this.withCache(key, async () => {
      const { from: gte, to: lte } = rangeOrDefault(from, to);
      const orders = await this.prisma.order.findMany({
        where: { status: OrderStatus.COMPLETED, date: { gte, lte } },
        select: {
          items: {
            select: {
              lineTotal: true,
              lineCost: true,
              product: {
                select: {
                  adSku: true,
                },
              },
            },
          },
        },
      });

      const skuMap = new Map<string, { rev: Decimal; cost: Decimal }>();
      for (const o of orders) {
        for (const it of o.items) {
          const sku = (it.product as any)?.adSku as string | null;
          if (!sku) continue;
          if (!skuMap.has(sku)) skuMap.set(sku, { rev: this.d(0), cost: this.d(0) });
          const agg = skuMap.get(sku)!;
          agg.rev = agg.rev.add(this.d(it.lineTotal));
          agg.cost = agg.cost.add(this.d(it.lineCost));
        }
      }

      const adSpends = await this.prisma.adSpend.groupBy({
        by: ['adSku'],
        where: { date: { gte, lte } },
        _sum: { amount: true },
      });
      const spendMap = new Map<string, Decimal>();
      for (const g of adSpends) {
        spendMap.set(g.adSku as string, this.d(g._sum.amount));
      }

      const result: any[] = [];
      for (const [sku, v] of skuMap.entries()) {
        const ad = spendMap.get(sku) || this.d(0);
        const profit = v.rev.sub(v.cost);
        const netProfit = profit.sub(ad);
        const roi = ad.eq(0) ? null : this.n(profit.div(ad));
        result.push({
          adSku: sku,
          revenue: this.n(v.rev),
          cost: this.n(v.cost),
          profit: this.n(profit),
          adSpend: this.n(ad),
          netProfit: this.n(netProfit),
          roi,
        });
      }
      return result;
    });
  }

  async dashboardSummary(from?: string, to?: string, limit = 10) {
    const key = this.cacheKey('dashboardSummary', [from, to, limit]);
    return this.withCache(
      key,
      async () => {
        const [overview, support] = await Promise.all([
          this.overview(from, to),
          this.dashboardSupport(from, to, limit),
        ]);

        return {
          overview,
          support,
        };
      },
      60_000,
    );
  }

  async seasonality(year?: number) {
    const key = this.cacheKey('seasonality', [year]);
    return this.withCache(key, async () => {
      const y = year || new Date().getFullYear();
      const orders = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.COMPLETED,
          date: {
            gte: new Date(`${y}-01-01`),
            lte: new Date(`${y}-12-31T23:59:59`),
          },
        },
        select: { date: true },
      });

      const byMonth = new Map<number, number>();
      for (let m = 0; m < 12; m++) byMonth.set(m, 0);
      orders.forEach(o => {
        const month = o.date.getMonth();
        byMonth.set(month, (byMonth.get(month) || 0) + 1);
      });

      const MONTHS_RU = [
        'Янв',
        'Фев',
        'Мар',
        'Апр',
        'Май',
        'Июн',
        'Июл',
        'Авг',
        'Сен',
        'Окт',
        'Ноя',
        'Дек',
      ];
      return Array.from(byMonth.entries()).map(([m, sales]) => ({
        month: MONTHS_RU[m],
        sales,
      }));
    });
  }

  async dashboardSupport(from?: string, to?: string, limit = 10) {
    const key = this.cacheKey('dashboardSupport', [from, to, limit]);
    return this.withCache(key, async () => {
      const { from: gte, to: lte } = rangeOrDefault(from, to);

      const [clientOrderGroups, totalClients, groupedTasks] = await Promise.all([
        this.prisma.order.groupBy({
          by: ['clientId'],
          where: {
            status: OrderStatus.COMPLETED,
            date: { gte, lte },
          },
          _count: { id: true },
          _sum: { totalPrice: true },
          _max: { date: true },
        }),
        this.prisma.client.count(),
        this.prisma.task.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
      ]);

      const sortedClientGroups = clientOrderGroups
        .map(row => ({
          clientId: row.clientId,
          ordersCount: row._count.id ?? 0,
          totalSpent: Number(row._sum?.totalPrice || 0),
          lastOrder: row._max?.date?.toISOString(),
        }))
        .sort((left, right) => {
          if (right.totalSpent !== left.totalSpent) return right.totalSpent - left.totalSpent;
          return right.ordersCount - left.ordersCount;
        });

      const topClientLimit = Math.min(Math.max(limit, 1), 20);
      const topClientIds = sortedClientGroups.slice(0, topClientLimit).map(row => row.clientId);

      const topClientRows = topClientIds.length
        ? await this.prisma.client.findMany({
            where: {
              id: { in: topClientIds },
            },
            select: {
              id: true,
              name: true,
              phone: true,
            },
          })
        : [];

      const clientDetails = new Map(topClientRows.map(row => [row.id, row]));
      const topClients = sortedClientGroups.slice(0, topClientLimit).map(row => {
        const client = clientDetails.get(row.clientId);
        return {
          id: row.clientId,
          name: client?.name || `Клиент #${row.clientId}`,
          phone: client?.phone || '',
          ordersCount: row.ordersCount,
          totalSpent: row.totalSpent,
          lastOrder: row.lastOrder,
          status: 'active' as const,
        };
      });

      const taskCounts = groupedTasks.reduce(
        (acc, item) => {
          const count = item._count._all;
          acc.total += count;
          if (item.status === 'NEW') acc.new += count;
          if (item.status === 'IN_PROGRESS') acc.inProgress += count;
          if (item.status === 'DONE') acc.completed += count;
          return acc;
        },
        { total: 0, new: 0, inProgress: 0, completed: 0, avgCompletionTime: 0 },
      );

      return {
        clientTotals: {
          total: totalClients,
          active: clientOrderGroups.length,
        },
        topClients,
        taskStats: taskCounts,
      };
    });
  }
}
