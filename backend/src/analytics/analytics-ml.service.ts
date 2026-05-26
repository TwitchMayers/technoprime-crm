import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type SkuForecastRow = {
  productId: number;
  name: string;
  adSku: string | null;
  stock: number;
  avgDailyUnits: number;
  viewsLast7d: number;
  viewsLast30d: number;
  demandSignal: number;
  trendPct: number;
  seasonalityIndex: number;
  forecast7: number;
  forecast30: number;
  recommendedPurchase: number;
};

type EmployeeForecastRow = {
  employeeId: number;
  name: string;
  roleLabel: string;
  recent14dDone: number;
  forecastNext7d: number;
  trendPct: number;
  riskScore: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  readinessLabel: string;
  recommendedLoadPct: number;
  averageResponseMinutes: number | null;
  peakDemandWindow: string | null;
  slowdownWindow: string | null;
  recommendation: string;
};

type AdBudgetWeekdayRow = {
  weekday: number;
  label: string;
  orders: number;
  revenue: number;
  profit: number;
  adSpend: number;
  netProfit: number;
  rawRoi: number | null;
  smoothedRoi: number;
  confidence: number;
  score: number;
  recommendedSharePct: number;
  recommendedBudget: number;
  recommendation: string;
};

type MlSnapshot = {
  generatedAt: string;
  skuForecast: SkuForecastRow[];
  employeeForecast: EmployeeForecastRow[];
};

@Injectable()
export class AnalyticsMlService {
  private readonly logger = new Logger(AnalyticsMlService.name);
  private snapshot: MlSnapshot | null = null;

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *')
  async nightlyRecompute() {
    await this.recompute();
  }

  async status() {
    return {
      generatedAt: this.snapshot?.generatedAt || null,
      hasData: !!this.snapshot,
      skuCount: this.snapshot?.skuForecast.length || 0,
      employeeCount: this.snapshot?.employeeForecast.length || 0,
    };
  }

  async recompute() {
    this.logger.log('ML recompute started');
    const [skuForecast, employeeForecast] = await Promise.all([
      this.computeSkuForecast(),
      this.computeEmployeeForecast(),
    ]);

    this.snapshot = {
      generatedAt: new Date().toISOString(),
      skuForecast,
      employeeForecast,
    };

    this.logger.log(
      `ML recompute finished. SKU rows: ${skuForecast.length}, employee rows: ${employeeForecast.length}`,
    );

    return this.snapshot;
  }

  async getSkuForecast(days: number) {
    if (!this.snapshot) {
      await this.recompute();
    }

    const horizon = days === 30 ? 30 : 7;
    const rows = (this.snapshot?.skuForecast || []).map(row => ({
      ...row,
      selectedForecast: horizon === 30 ? row.forecast30 : row.forecast7,
    }));

    return {
      generatedAt: this.snapshot?.generatedAt || null,
      horizonDays: horizon,
      items: rows,
    };
  }

  async getEmployeeForecast() {
    if (!this.snapshot) {
      await this.recompute();
    }

    return {
      generatedAt: this.snapshot?.generatedAt || null,
      items: this.snapshot?.employeeForecast || [],
    };
  }

  async getAdBudgetForecast(from?: string, to?: string, totalWeeklyBudget?: number) {
    const now = new Date();
    const rangeTo = this.parseDate(to, now);
    const defaultFrom = new Date(rangeTo);
    defaultFrom.setDate(defaultFrom.getDate() - 55);
    const rangeFrom = this.parseDate(from, defaultFrom);
    const msInDay = 24 * 60 * 60 * 1000;
    const dayCount = Math.max(
      1,
      Math.floor((rangeTo.getTime() - rangeFrom.getTime()) / msInDay) + 1,
    );

    const [orders, adSpendRows] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          status: OrderStatus.COMPLETED,
          date: {
            gte: rangeFrom,
            lte: rangeTo,
          },
        },
        select: {
          date: true,
          totalPrice: true,
          costPrice: true,
          profit: true,
        },
      }),
      this.prisma.adSpend.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          date: {
            gte: rangeFrom,
            lte: rangeTo,
          },
        },
        select: {
          date: true,
          amount: true,
        },
      }),
    ]);

    const weekdayRows: AdBudgetWeekdayRow[] = new Array(7).fill(null).map((_, weekday) => ({
      weekday,
      label: this.weekdayLabel(weekday),
      orders: 0,
      revenue: 0,
      profit: 0,
      adSpend: 0,
      netProfit: 0,
      rawRoi: null,
      smoothedRoi: 0,
      confidence: 0,
      score: 0,
      recommendedSharePct: 0,
      recommendedBudget: 0,
      recommendation: '',
    }));

    for (const order of orders) {
      const weekday = this.moscowWeekday(order.date);
      const row = weekdayRows[weekday];
      row.orders += 1;
      row.revenue += Number(order.totalPrice || 0);
      row.profit +=
        Number(order.profit || 0) || Number(order.totalPrice || 0) - Number(order.costPrice || 0);
    }

    for (const spend of adSpendRows) {
      const weekday = this.moscowWeekday(spend.date);
      const row = weekdayRows[weekday];
      row.adSpend += Number(spend.amount || 0);
    }

    for (const row of weekdayRows) {
      row.netProfit = row.profit - row.adSpend;
      row.rawRoi = row.adSpend > 0 ? row.netProfit / row.adSpend : null;
    }

    const totalRevenue = weekdayRows.reduce((acc, row) => acc + row.revenue, 0);
    const totalProfit = weekdayRows.reduce((acc, row) => acc + row.profit, 0);
    const totalAdSpend = weekdayRows.reduce((acc, row) => acc + row.adSpend, 0);
    const totalOrders = weekdayRows.reduce((acc, row) => acc + row.orders, 0);
    const totalNetProfit = totalProfit - totalAdSpend;
    const priorRoi = totalAdSpend > 0 ? totalNetProfit / totalAdSpend : 0.15;
    const priorProfitPerOrder = totalOrders > 0 ? totalNetProfit / totalOrders : 1;
    const roiPriorWeight = Math.max(3000, totalAdSpend / 4 || 3000);
    const volumePriorWeight = 6;

    for (const row of weekdayRows) {
      const rawRoi = row.rawRoi == null ? priorRoi : row.rawRoi;
      row.smoothedRoi =
        (rawRoi * row.adSpend + priorRoi * roiPriorWeight) / (row.adSpend + roiPriorWeight);

      const netProfitPerOrder = row.orders > 0 ? row.netProfit / row.orders : priorProfitPerOrder;
      const smoothedProfitPerOrder =
        (netProfitPerOrder * row.orders + priorProfitPerOrder * volumePriorWeight) /
        (row.orders + volumePriorWeight);

      const ordersConfidence = 1 - Math.exp(-row.orders / 4);
      const spendConfidence =
        totalAdSpend > 0 ? Math.min(1, row.adSpend / Math.max(1, totalAdSpend / 3)) : 0;
      row.confidence = Number((ordersConfidence * 0.6 + spendConfidence * 0.4).toFixed(3));

      const normalizedProfitPerOrder =
        Math.abs(priorProfitPerOrder) < 1
          ? 0
          : smoothedProfitPerOrder / Math.max(Math.abs(priorProfitPerOrder), 1);

      row.score = row.smoothedRoi * 0.62 + normalizedProfitPerOrder * 0.24 + row.confidence * 0.14;
    }

    const minScore = Math.min(...weekdayRows.map(row => row.score));
    const shiftedWeights = weekdayRows.map(row => Math.max(0.06, row.score - minScore + 0.18));
    const totalWeight = shiftedWeights.reduce((acc, value) => acc + value, 0) || 1;

    const historicalWeeklyBudget = totalAdSpend > 0 ? (totalAdSpend / dayCount) * 7 : 0;
    const effectiveWeeklyBudget =
      Number.isFinite(Number(totalWeeklyBudget)) && Number(totalWeeklyBudget) > 0
        ? Number(totalWeeklyBudget)
        : historicalWeeklyBudget;

    weekdayRows.forEach((row, index) => {
      const share = shiftedWeights[index] / totalWeight;
      row.recommendedSharePct = Number((share * 100).toFixed(2));
      row.recommendedBudget = Number((effectiveWeeklyBudget * share).toFixed(2));

      if (row.confidence < 0.25) {
        row.recommendation = 'Низкая уверенность: данных по этому дню пока мало.';
      } else if (row.smoothedRoi >= priorRoi + 0.18) {
        row.recommendation = 'Усилить бюджет: день показывает устойчивую отдачу выше среднего.';
      } else if (row.smoothedRoi <= priorRoi - 0.18) {
        row.recommendation = 'Снизить бюджет: день проигрывает среднему ROI за окно наблюдения.';
      } else {
        row.recommendation = 'Держать в базовом диапазоне: эффективность близка к среднему уровню.';
      }
    });

    return {
      generatedAt: new Date().toISOString(),
      window: {
        from: rangeFrom.toISOString().slice(0, 10),
        to: rangeTo.toISOString().slice(0, 10),
        days: dayCount,
      },
      totals: {
        revenue: Number(totalRevenue.toFixed(2)),
        profit: Number(totalProfit.toFixed(2)),
        adSpend: Number(totalAdSpend.toFixed(2)),
        netProfit: Number(totalNetProfit.toFixed(2)),
        orders: totalOrders,
      },
      baselines: {
        priorRoi: Number(priorRoi.toFixed(4)),
        historicalWeeklyBudget: Number(historicalWeeklyBudget.toFixed(2)),
        recommendedWeeklyBudget: Number(effectiveWeeklyBudget.toFixed(2)),
      },
      rows: weekdayRows,
      bestDays: [...weekdayRows]
        .sort((left, right) => right.recommendedSharePct - left.recommendedSharePct)
        .slice(0, 3)
        .map(row => row.label),
    };
  }

  private async computeSkuForecast(): Promise<SkuForecastRow[]> {
    const today = new Date();
    const since = new Date(today);
    since.setDate(since.getDate() - 180);

    const products = await this.prisma.product.findMany({
      where: {
        tenant: 'TECHNOPRIME',
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        adSku: true,
        stock: true,
      },
      orderBy: { id: 'desc' },
      take: 500,
    });

    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          tenant: 'TECHNOPRIME',
          status: OrderStatus.COMPLETED,
          date: { gte: since },
        },
      },
      select: {
        productId: true,
        qty: true,
        order: { select: { date: true } },
      },
    });

    const viewEvents = await this.prisma.productViewEvent.findMany({
      where: {
        tenant: 'TECHNOPRIME',
        viewedAt: { gte: since },
      },
      select: {
        productId: true,
        viewedAt: true,
      },
    });

    const byProductDay = new Map<number, Map<string, number>>();
    for (const it of items) {
      const day = it.order.date.toISOString().slice(0, 10);
      if (!byProductDay.has(it.productId)) {
        byProductDay.set(it.productId, new Map());
      }
      const row = byProductDay.get(it.productId)!;
      row.set(day, (row.get(day) || 0) + it.qty);
    }

    const viewsByProductDay = new Map<number, Map<string, number>>();
    for (const event of viewEvents) {
      const day = event.viewedAt.toISOString().slice(0, 10);
      if (!viewsByProductDay.has(event.productId)) {
        viewsByProductDay.set(event.productId, new Map());
      }
      const row = viewsByProductDay.get(event.productId)!;
      row.set(day, (row.get(day) || 0) + 1);
    }

    const seriesDays = 84;
    const days: string[] = [];
    for (let i = seriesDays - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const result: SkuForecastRow[] = [];
    for (const product of products) {
      const map = byProductDay.get(product.id) || new Map<string, number>();
      const values = days.map(d => map.get(d) || 0);
      const viewMap = viewsByProductDay.get(product.id) || new Map<string, number>();
      const viewValues = days.map(d => viewMap.get(d) || 0);

      const avg7 = this.avg(values.slice(-7));
      const avg28 = this.avg(values.slice(-28));
      const avgViews7 = this.avg(viewValues.slice(-7));
      const avgViews28 = this.avg(viewValues.slice(-28));
      const viewsLast7d = Math.round(viewValues.slice(-7).reduce((acc, v) => acc + v, 0));
      const viewsLast30d = Math.round(viewValues.slice(-30).reduce((acc, v) => acc + v, 0));

      const orderTrendPct = avg28 > 0 ? ((avg7 - avg28) / avg28) * 100 : 0;
      const viewTrendPct = avgViews28 > 0 ? ((avgViews7 - avgViews28) / avgViews28) * 100 : 0;
      const demandSignal = avgViews7 * 0.04;
      const blendedAvgDaily = avg7 * 0.82 + demandSignal * 0.18;
      const trendPct = orderTrendPct * 0.75 + viewTrendPct * 0.25;
      const weekdayAvg = this.weekdayAverages(days, values);
      const seasonalityIndex = this.seasonalityIndex(weekdayAvg);
      const forecast7 = this.forecastWithSeasonality(blendedAvgDaily, trendPct, weekdayAvg, 7);
      const forecast30 = this.forecastWithSeasonality(blendedAvgDaily, trendPct, weekdayAvg, 30);
      const recommendedPurchase = Math.max(
        0,
        Math.ceil(forecast30 * 1.15 - Number(product.stock || 0)),
      );

      result.push({
        productId: product.id,
        name: product.name,
        adSku: product.adSku || null,
        stock: Number(product.stock || 0),
        avgDailyUnits: Number(blendedAvgDaily.toFixed(2)),
        viewsLast7d,
        viewsLast30d,
        demandSignal: Number(demandSignal.toFixed(2)),
        trendPct: Number(trendPct.toFixed(2)),
        seasonalityIndex: Number(seasonalityIndex.toFixed(2)),
        forecast7: Number(forecast7.toFixed(2)),
        forecast30: Number(forecast30.toFixed(2)),
        recommendedPurchase,
      });
    }

    return result.sort((a, b) => b.forecast30 - a.forecast30);
  }

  private async computeEmployeeForecast(): Promise<EmployeeForecastRow[]> {
    const today = new Date();
    const since = new Date(today);
    since.setDate(since.getDate() - 90);

    const [orders, chatEvents] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          status: OrderStatus.COMPLETED,
          date: { gte: since },
          managerId: { not: null },
        },
        select: {
          date: true,
          managerId: true,
          manager: { select: { id: true, name: true, login: true, role: true } },
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          action: { in: ['AVITO_CHAT_INCOMING', 'AVITO_CHAT_REPLY_SENT'] },
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          action: true,
          userId: true,
          newData: true,
          createdAt: true,
        },
      }),
    ]);

    const groups = new Map<number, { name: string; roleLabel: string; dates: Date[] }>();
    for (const o of orders) {
      if (!o.managerId) continue;
      const login = String(o.manager?.login || '').toLowerCase();
      const name = String(o.manager?.name || '').toLowerCase();
      if (
        login === 'alexey' ||
        login === 'alexander' ||
        login === 'luka' ||
        name === 'алексей мураитов' ||
        name === 'александр ануфриев' ||
        name === 'иван лукашин'
      ) {
        continue;
      }
      if (!groups.has(o.managerId)) {
        const roleLabel =
          o.manager?.role === 'SUPER_ADMIN'
            ? 'Супер-админ'
            : o.manager?.role === 'ADMIN'
              ? 'Администратор'
              : o.manager?.role === 'TECHNICAL_SPECIALIST'
                ? 'Технический специалист'
                : 'Менеджер';
        groups.set(o.managerId, {
          name: o.manager?.name || `#${o.managerId}`,
          roleLabel,
          dates: [],
        });
      }
      groups.get(o.managerId)!.dates.push(o.date);
    }

    type ChatPerfRow = {
      totalMinutes: number;
      count: number;
      inboundByHour: Map<number, number>;
      responseByHour: Map<number, { totalMinutes: number; count: number }>;
    };

    const chatPerfMap = new Map<number, ChatPerfRow>();
    const lastInboundByChat = new Map<string, Date>();
    const toChatKey = (raw: any) => String(raw?.chatKey || '').trim();
    const toMessageAt = (raw: any, fallback: Date) => {
      const input = raw?.messageAt || raw?.sentAt || raw?.createdAt || null;
      const parsed = input ? new Date(input) : fallback;
      return Number.isNaN(parsed.getTime()) ? fallback : parsed;
    };

    for (const event of chatEvents) {
      const payload = (event.newData || {}) as any;
      const chatKey = toChatKey(payload);
      if (!chatKey) continue;

      if (event.action === 'AVITO_CHAT_INCOMING') {
        lastInboundByChat.set(chatKey, toMessageAt(payload, event.createdAt));
        continue;
      }

      if (event.action !== 'AVITO_CHAT_REPLY_SENT' || !event.userId) continue;
      const inboundAt = lastInboundByChat.get(chatKey);
      if (!inboundAt) continue;

      const repliedAt = toMessageAt(payload, event.createdAt);
      const diffMinutes = Math.round((repliedAt.getTime() - inboundAt.getTime()) / (60 * 1000));
      if (!Number.isFinite(diffMinutes) || diffMinutes < 0 || diffMinutes > 8 * 60) continue;

      const existing = chatPerfMap.get(event.userId) || {
        totalMinutes: 0,
        count: 0,
        inboundByHour: new Map<number, number>(),
        responseByHour: new Map<number, { totalMinutes: number; count: number }>(),
      };
      existing.totalMinutes += diffMinutes;
      existing.count += 1;

      const inboundHour = new Date(
        new Date(inboundAt).toLocaleString('en-US', {
          timeZone: 'Europe/Moscow',
        }),
      ).getHours();
      existing.inboundByHour.set(inboundHour, (existing.inboundByHour.get(inboundHour) || 0) + 1);
      const hourPerf = existing.responseByHour.get(inboundHour) || { totalMinutes: 0, count: 0 };
      hourPerf.totalMinutes += diffMinutes;
      hourPerf.count += 1;
      existing.responseByHour.set(inboundHour, hourPerf);

      chatPerfMap.set(event.userId, existing);
    }

    const rows: EmployeeForecastRow[] = [];
    for (const [employeeId, group] of groups.entries()) {
      const recent14dDone = this.countBetween(group.dates, 14, 0);
      const prev14dDone = this.countBetween(group.dates, 28, 14);
      const dailyRecent = recent14dDone / 14;
      const trendPct = prev14dDone > 0 ? ((recent14dDone - prev14dDone) / prev14dDone) * 100 : 0;
      const perf = chatPerfMap.get(employeeId);
      const averageResponseMinutes =
        perf && perf.count > 0 ? Number((perf.totalMinutes / perf.count).toFixed(1)) : null;
      const trendFactor = Math.max(0.55, Math.min(1.35, 1 + (trendPct / 100) * 0.45));
      const responseFactor =
        averageResponseMinutes == null
          ? 1
          : Math.max(0.78, Math.min(1.12, 1 - (averageResponseMinutes - 12) / 120));
      const forecastNext7d = Math.max(0, dailyRecent * trendFactor * responseFactor * 7);
      const weeklySeries = this.weeklyCounts(group.dates, 8);
      const volatility = this.coefficientOfVariation(weeklySeries);

      let riskScore = 0;
      if (trendPct < -25) riskScore += 55;
      else if (trendPct < -10) riskScore += 35;
      if (recent14dDone < 3) riskScore += 20;
      if (volatility > 0.8) riskScore += 20;
      else if (volatility > 0.5) riskScore += 10;
      if (averageResponseMinutes != null) {
        if (averageResponseMinutes >= 40) riskScore += 26;
        else if (averageResponseMinutes >= 30) riskScore += 18;
        else if (averageResponseMinutes >= 18) riskScore += 9;
      }
      riskScore = Math.max(0, Math.min(100, Math.round(riskScore)));

      const risk: 'LOW' | 'MEDIUM' | 'HIGH' =
        riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW';

      const peakHour =
        perf && perf.inboundByHour.size
          ? ([...perf.inboundByHour.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ??
            null)
          : null;
      const slowdownHourEntry =
        perf && perf.responseByHour.size
          ? [...perf.responseByHour.entries()]
              .map(([hour, value]) => ({
                hour,
                avg: value.count > 0 ? value.totalMinutes / value.count : 0,
                count: value.count,
              }))
              .filter(row => row.count >= 2)
              .sort((left, right) => right.avg - left.avg)[0] || null
          : null;
      const peakDemandWindow = peakHour == null ? null : this.formatHourWindow(peakHour);
      const slowdownWindow =
        slowdownHourEntry && slowdownHourEntry.avg >= 18
          ? this.formatHourWindow(slowdownHourEntry.hour)
          : null;

      const readinessLabel =
        risk === 'HIGH' ? 'Риск просадки' : risk === 'MEDIUM' ? 'Зона внимания' : 'Стабильно';

      const recommendation =
        risk === 'HIGH'
          ? `Снизить пик задач и усилить контроль качества ответов${slowdownWindow ? ` в интервале ${slowdownWindow}` : ''}. Нужен фокус на дожиме тёплых лидов.`
          : risk === 'MEDIUM'
            ? `Держать нагрузку в рабочем диапазоне и разгружать менеджера${slowdownWindow ? ` в интервале ${slowdownWindow}` : ''}. Добавить контроль по срокам первого ответа.`
            : `Можно аккуратно увеличивать нагрузку на входящие${peakDemandWindow ? ` в пике ${peakDemandWindow}` : ''}${slowdownWindow ? `, но в ${slowdownWindow} лучше не перегружать` : ''}.`;

      rows.push({
        employeeId,
        name: group.name,
        roleLabel: group.roleLabel,
        recent14dDone,
        forecastNext7d: Number(forecastNext7d.toFixed(2)),
        trendPct: Number(trendPct.toFixed(2)),
        riskScore,
        risk,
        readinessLabel,
        recommendedLoadPct: 0,
        averageResponseMinutes,
        peakDemandWindow,
        slowdownWindow,
        recommendation,
      });
    }

    const totalForecast = rows.reduce((acc, r) => acc + r.forecastNext7d, 0);
    for (const row of rows) {
      row.recommendedLoadPct =
        totalForecast > 0 ? Number(((row.forecastNext7d / totalForecast) * 100).toFixed(1)) : 0;
    }

    return rows.sort((a, b) => b.forecastNext7d - a.forecastNext7d);
  }

  private parseDate(value: string | undefined, fallback: Date) {
    if (!value) return new Date(fallback);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return new Date(fallback);
    return date;
  }

  private moscowWeekday(date: Date | string) {
    const moscowDate = new Date(
      new Date(date).toLocaleString('en-US', {
        timeZone: 'Europe/Moscow',
      }),
    );
    return moscowDate.getDay();
  }

  private weekdayLabel(weekday: number) {
    const labels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return labels[weekday] || `День ${weekday}`;
  }

  private avg(values: number[]) {
    if (!values.length) return 0;
    return values.reduce((acc, v) => acc + v, 0) / values.length;
  }

  private weekdayAverages(days: string[], values: number[]) {
    const sums = new Array(7).fill(0);
    const counts = new Array(7).fill(0);
    for (let i = 0; i < days.length; i += 1) {
      const wd = new Date(days[i]).getDay();
      sums[wd] += values[i];
      counts[wd] += 1;
    }
    return sums.map((sum, idx) => (counts[idx] ? sum / counts[idx] : 0));
  }

  private seasonalityIndex(weekdayAvg: number[]) {
    const base = this.avg(weekdayAvg);
    if (base <= 0) return 0;
    const variance = this.avg(weekdayAvg.map(x => (x - base) ** 2));
    return Math.sqrt(variance) / base;
  }

  private forecastWithSeasonality(
    avg7: number,
    trendPct: number,
    weekdayAvg: number[],
    horizon: number,
  ) {
    const trendFactor = 1 + (trendPct / 100) * 0.3;
    const baseWeekday = this.avg(weekdayAvg) || 1;
    let total = 0;
    for (let i = 1; i <= horizon; i += 1) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const wd = d.getDay();
      const seasonFactor = weekdayAvg[wd] > 0 ? weekdayAvg[wd] / baseWeekday : 1;
      const daily = Math.max(0, avg7 * trendFactor * seasonFactor);
      total += daily;
    }
    return total;
  }

  private countBetween(dates: Date[], daysBackStart: number, daysBackEnd: number) {
    const now = Date.now();
    const max = now - daysBackEnd * 24 * 60 * 60 * 1000;
    const min = now - daysBackStart * 24 * 60 * 60 * 1000;
    return dates.filter(d => {
      const t = d.getTime();
      return t >= min && t < max;
    }).length;
  }

  private weeklyCounts(dates: Date[], weeks: number) {
    const buckets = new Array(weeks).fill(0);
    const now = Date.now();
    for (const d of dates) {
      const diffDays = Math.floor((now - d.getTime()) / (24 * 60 * 60 * 1000));
      const bucket = Math.floor(diffDays / 7);
      if (bucket >= 0 && bucket < weeks) {
        buckets[bucket] += 1;
      }
    }
    return buckets;
  }

  private coefficientOfVariation(values: number[]) {
    const mean = this.avg(values);
    if (mean <= 0) return 0;
    const variance = this.avg(values.map(x => (x - mean) ** 2));
    return Math.sqrt(variance) / mean;
  }

  private formatHourWindow(hour: number) {
    const normalized = ((hour % 24) + 24) % 24;
    const next = (normalized + 1) % 24;
    return `${String(normalized).padStart(2, '0')}:00–${String(next).padStart(2, '0')}:00`;
  }
}
