import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrderStatus } from '@prisma/client';
import Decimal from 'decimal.js';

function startOfDay(d: Date) { return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)); }
function endOfDay(d: Date) { return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)); }

function rangeOrDefault(from?: string, to?: string) {
  if (from && to) return { from: startOfDay(new Date(from)), to: endOfDay(new Date(to)) };
  const now = new Date();
  const fromDef = new Date(now); fromDef.setDate(fromDef.getDate() - 6);
  return { from: startOfDay(fromDef), to: endOfDay(now) };
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private d(v: any) { return new Decimal(v || 0); }
  private n(d: Decimal) { return Number(d.toFixed(2)); }

  async overview(from?: string, to?: string) {
    const { from: gte, to: lte } = rangeOrDefault(from, to);

    const orders = await this.prisma.order.findMany({
      where: { status: OrderStatus.COMPLETED, date: { gte, lte } },
      include: { items: { include: { product: true } } },
      orderBy: { date: 'asc' },
    });

    let revenue = this.d(0), cost = this.d(0);
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

    const adSpends = await this.prisma.adSpend.findMany({ where: { date: { gte, lte } }, orderBy: { date: 'asc' } });
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
  }

  async employees(from?: string, to?: string) {
    const { from: gte, to: lte } = rangeOrDefault(from, to);
    const orders = await this.prisma.order.findMany({
      where: { status: OrderStatus.COMPLETED, date: { gte, lte } },
      include: { items: true, manager: true },
    });

    const map = new Map<number, { name: string; closedCount: number; revenue: Decimal; cost: Decimal }>();
    for (const o of orders) {
      const mid = o.managerId ?? 0;
      const name = o.manager?.name || (mid ? `#${mid}` : '—');
      if (!map.has(mid)) map.set(mid, { name, closedCount: 0, revenue: this.d(0), cost: this.d(0) });
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
  }

  async salesByAds(from?: string, to?: string) {
    const { from: gte, to: lte } = rangeOrDefault(from, to);
    const orders = await this.prisma.order.findMany({
      where: { status: OrderStatus.COMPLETED, date: { gte, lte } },
      include: { items: { include: { product: true } } },
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
  }

  async seasonality(year?: number) {
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
    for (let m=0; m<12; m++) byMonth.set(m, 0);
    orders.forEach(o => {
      const month = o.date.getMonth();
      byMonth.set(month, (byMonth.get(month) || 0) + 1);
    });

    const MONTHS_RU = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
    return Array.from(byMonth.entries()).map(([m, sales]) => ({
      month: MONTHS_RU[m],
      sales,
    }));
  }
}