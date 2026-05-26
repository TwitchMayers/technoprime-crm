import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import {
  CommunicationChannel,
  Prisma,
  OrderStatus,
  Position,
  Role,
  TaskStatus,
} from '@prisma/client';
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
} from 'date-fns';

type EmployeePeriod = 'today' | 'week' | 'month' | 'year';

type AdminUser = {
  id?: number;
  role?: Role | string;
};

type ChatPerformanceStats = {
  answeredChats: Map<number, number>;
  responseMinutes: Map<number, { total: number; count: number }>;
};

const SHIFT_BASE_RATE_RUB = 2000;
const CONSOLE_SALE_BONUS_RUB = 1000;

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  private getPeriodRange(period: EmployeePeriod) {
    const now = new Date();

    if (period === 'today') {
      return { from: startOfDay(now), to: endOfDay(now) };
    }

    if (period === 'week') {
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      };
    }

    if (period === 'year') {
      return {
        from: startOfYear(now),
        to: endOfYear(now),
      };
    }

    return {
      from: startOfMonth(now),
      to: endOfMonth(now),
    };
  }

  private normalizePeriod(period?: string): EmployeePeriod {
    if (period === 'today' || period === 'week' || period === 'year') {
      return period;
    }
    return 'month';
  }

  private normalizePhone(input?: string | null) {
    const digits = String(input || '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length === 10) return `8${digits}`;
    if (digits.length === 11 && digits.startsWith('7')) return `8${digits.slice(1)}`;
    if (digits.length === 11 && digits.startsWith('8')) return digits;
    return digits.length >= 11 ? digits.slice(-11) : digits;
  }

  private isHiddenEmployeeProfile(
    profile?: { login?: string | null; name?: string | null } | null,
  ) {
    const login = String(profile?.login || '')
      .trim()
      .toLowerCase();
    const name = String(profile?.name || '')
      .trim()
      .toLowerCase();
    return (
      login === 'alexey' ||
      login === 'alexander' ||
      login === 'luka' ||
      name === 'алексей мураитов' ||
      name === 'александр ануфриев' ||
      name === 'иван лукашин'
    );
  }

  private assertSuperAdmin(user?: AdminUser) {
    if (!user?.id || !user?.role) {
      throw new UnauthorizedException('User is not authenticated');
    }

    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Доступ только для супер-администратора');
    }
  }

  private assertAdminAnalyticsAccess(user?: AdminUser) {
    if (!user?.id || !user?.role) {
      throw new UnauthorizedException('User is not authenticated');
    }
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      throw new ForbiddenException('Доступ только для администратора');
    }
  }

  private defaultPositionByRole(role: Role): Position {
    if (role === 'TECHNICAL_SPECIALIST') return Position.TECHNICIAN;
    if (role === 'SUPER_ADMIN') return Position.OWNER;
    return Position.MANAGER;
  }

  private async writeAuditLog(
    userId: number | null | undefined,
    action: string,
    entityType: string,
    entityId?: number | null,
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

  private async buildCompletedOrderStats(
    logs: Array<{
      userId?: number | null;
      entityId?: number | null;
      newData?: unknown;
    }>,
  ) {
    const completionLogs = logs.filter(log => {
      const nextStatus = String((log.newData as any)?.status || '').toUpperCase();
      return Boolean(log.userId && log.entityId && nextStatus === 'COMPLETED');
    });

    if (!completionLogs.length) {
      return new Map<number, { count: number; revenue: number; profit: number }>();
    }

    const orderIds = Array.from(new Set(completionLogs.map(log => Number(log.entityId))));
    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        totalPrice: true,
        profit: true,
      },
    });

    const orderMap = new Map(
      orders.map(order => [
        order.id,
        {
          revenue: Number(order.totalPrice || 0),
          profit: Number(order.profit || 0),
        },
      ]),
    );

    const stats = new Map<number, { count: number; revenue: number; profit: number }>();

    for (const log of completionLogs) {
      const employeeId = Number(log.userId);
      const orderId = Number(log.entityId);
      const order = orderMap.get(orderId);
      if (!employeeId || !order) continue;

      const current = stats.get(employeeId) || {
        count: 0,
        revenue: 0,
        profit: 0,
      };

      current.count += 1;
      current.revenue += order.revenue;
      current.profit += order.profit;
      stats.set(employeeId, current);
    }

    return stats;
  }

  private moscowDateParts(date: Date) {
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const read = (type: string) => Number(parts.find(part => part.type === type)?.value || 0);
    const year = read('year');
    const month = read('month');
    const day = read('day');
    const hour = read('hour');
    const minute = read('minute');
    return {
      year,
      month,
      day,
      hour,
      minute,
      dayKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      minutesOfDay: hour * 60 + minute,
    };
  }

  private isWithinWorkWindow(date: Date) {
    const { hour } = this.moscowDateParts(date);
    return hour >= 9 && hour < 19;
  }

  private isWorkWindowPair(incomingAt: Date, replyAt: Date) {
    if (!this.isWithinWorkWindow(incomingAt) || !this.isWithinWorkWindow(replyAt)) {
      return false;
    }
    const incoming = this.moscowDateParts(incomingAt);
    const reply = this.moscowDateParts(replyAt);
    return incoming.dayKey === reply.dayKey;
  }

  private safeDate(value: unknown) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  private isSameMoscowDay(date: Date, dayKey: string) {
    return this.moscowDateParts(date).dayKey === dayKey;
  }

  private parseAvitoChatKey(value: unknown) {
    const normalized = String(value || '').trim();
    if (!normalized) return null;
    return normalized;
  }

  private async assertActiveEmployee(userId?: number) {
    if (!userId || Number.isNaN(userId)) {
      throw new UnauthorizedException('User is not authenticated');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!employee) {
      throw new UnauthorizedException('Сотрудник не найден');
    }
    if (!employee.isActive) {
      throw new ForbiddenException('Учётная запись сотрудника отключена');
    }

    return employee;
  }

  private async getShiftSnapshot(employeeId: number) {
    const now = new Date();
    const todayMoscowKey = this.moscowDateParts(now).dayKey;
    const scanFrom = subDays(startOfDay(now), 2);
    const scanTo = endOfDay(now);

    const shifts = await this.prisma.employeeShift.findMany({
      where: {
        employeeId,
        OR: [
          { status: 'OPEN' },
          { startedAt: { gte: scanFrom, lte: scanTo } },
          { endedAt: { gte: scanFrom, lte: scanTo } },
        ],
      },
      orderBy: [{ startedAt: 'desc' }],
      take: 32,
    });

    const openShift = shifts.find(shift => shift.status === 'OPEN') || null;
    let todayShiftStartedAt: Date | null = null;
    let todayShiftEndedAt: Date | null = null;

    for (const shift of shifts) {
      const startedAt = this.safeDate(shift.startedAt);
      const endedAt = this.safeDate(shift.endedAt);
      const startedToday = Boolean(startedAt && this.isSameMoscowDay(startedAt, todayMoscowKey));
      const endedToday = Boolean(endedAt && this.isSameMoscowDay(endedAt, todayMoscowKey));

      if (startedToday && startedAt) {
        if (!todayShiftStartedAt || startedAt.getTime() < todayShiftStartedAt.getTime()) {
          todayShiftStartedAt = startedAt;
        }
      }

      if (endedToday && endedAt) {
        if (!todayShiftEndedAt || endedAt.getTime() > todayShiftEndedAt.getTime()) {
          todayShiftEndedAt = endedAt;
        }
        if (!todayShiftStartedAt && startedAt) {
          todayShiftStartedAt = startedAt;
        }
      }
    }

    if (openShift && this.isSameMoscowDay(openShift.startedAt, todayMoscowKey)) {
      if (!todayShiftStartedAt || openShift.startedAt.getTime() < todayShiftStartedAt.getTime()) {
        todayShiftStartedAt = openShift.startedAt;
      }
      todayShiftEndedAt = null;
    }

    return {
      isOnShift: Boolean(openShift),
      currentShift: openShift
        ? {
            id: openShift.id,
            startedAt: openShift.startedAt.toISOString(),
            endedAt: openShift.endedAt ? openShift.endedAt.toISOString() : null,
            status: openShift.status,
          }
        : null,
      todayShiftStartedAt: todayShiftStartedAt ? todayShiftStartedAt.toISOString() : null,
      todayShiftEndedAt: todayShiftEndedAt ? todayShiftEndedAt.toISOString() : null,
    };
  }

  private async computeTodayUnansweredByEmployees(employeeIds: number[]) {
    const targetIds = Array.from(
      new Set(employeeIds.map(id => Number(id)).filter(id => Number.isFinite(id) && id > 0)),
    );
    const targetSet = new Set(targetIds);
    const unresolvedMap = new Map<number, number>();
    if (!targetIds.length) {
      return unresolvedMap;
    }

    const now = new Date();
    const todayMoscowKey = this.moscowDateParts(now).dayKey;
    const todayScanFrom = subDays(startOfDay(now), 2);
    const todayScanTo = endOfDay(now);
    const unresolvedScanFrom = subDays(todayScanFrom, 7);

    const [websiteLogs, avitoIncomingLogs, avitoReplyLogs] = await Promise.all([
      this.prisma.clientCommunicationLog.findMany({
        where: {
          channel: CommunicationChannel.WEBSITE,
          sentAt: { gte: unresolvedScanFrom, lte: todayScanTo },
        },
        select: {
          clientId: true,
          createdById: true,
          sentAt: true,
        },
        orderBy: [{ clientId: 'asc' }, { sentAt: 'asc' }],
      }),
      this.prisma.auditLog.findMany({
        where: {
          action: 'AVITO_CHAT_INCOMING',
          createdAt: { gte: unresolvedScanFrom, lte: todayScanTo },
        },
        select: {
          createdAt: true,
          newData: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        where: {
          action: 'AVITO_CHAT_REPLY_SENT',
          createdAt: { gte: unresolvedScanFrom, lte: todayScanTo },
          userId: { not: null },
        },
        select: {
          userId: true,
          createdAt: true,
          newData: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const increment = (employeeId: number, count = 1) => {
      if (!targetSet.has(employeeId) || count <= 0) return;
      unresolvedMap.set(employeeId, (unresolvedMap.get(employeeId) || 0) + count);
    };

    type WebsiteConversationState = {
      lastManagerId: number | null;
      pendingOwnerId: number | null;
      pendingTodayCount: number;
    };
    const websiteStateMap = new Map<number, WebsiteConversationState>();
    const ensureWebsiteState = (clientId: number) => {
      const existing = websiteStateMap.get(clientId);
      if (existing) return existing;
      const created: WebsiteConversationState = {
        lastManagerId: null,
        pendingOwnerId: null,
        pendingTodayCount: 0,
      };
      websiteStateMap.set(clientId, created);
      return created;
    };

    for (const log of websiteLogs) {
      const clientId = Number(log.clientId || 0);
      if (!clientId) continue;
      const state = ensureWebsiteState(clientId);
      const managerId = Number(log.createdById || 0);

      if (managerId) {
        state.lastManagerId = managerId;
        state.pendingOwnerId = null;
        state.pendingTodayCount = 0;
        continue;
      }

      if (this.isSameMoscowDay(log.sentAt, todayMoscowKey) && state.lastManagerId) {
        state.pendingOwnerId = state.lastManagerId;
        state.pendingTodayCount += 1;
      }
    }

    for (const state of websiteStateMap.values()) {
      if (state.pendingOwnerId && state.pendingTodayCount > 0) {
        increment(state.pendingOwnerId, state.pendingTodayCount);
      }
    }

    type AvitoEvent = {
      chatKey: string;
      at: Date;
      type: 'INCOMING' | 'REPLY';
      employeeId: number | null;
    };
    const avitoEvents: AvitoEvent[] = [];

    for (const log of avitoIncomingLogs) {
      const payload = (log.newData || {}) as Record<string, any>;
      const chatKey = this.parseAvitoChatKey(payload.chatKey);
      if (!chatKey) continue;
      const incomingAt = this.safeDate(payload.messageAt) || log.createdAt;
      avitoEvents.push({
        chatKey,
        at: incomingAt,
        type: 'INCOMING',
        employeeId: null,
      });
    }

    for (const log of avitoReplyLogs) {
      const employeeId = Number(log.userId || 0);
      if (!employeeId) continue;
      const payload = (log.newData || {}) as Record<string, any>;
      const chatKey = this.parseAvitoChatKey(payload.chatKey);
      if (!chatKey) continue;
      const replyAt = this.safeDate(payload.sentAt) || log.createdAt;
      avitoEvents.push({
        chatKey,
        at: replyAt,
        type: 'REPLY',
        employeeId,
      });
    }

    avitoEvents.sort((left, right) => left.at.getTime() - right.at.getTime());

    type AvitoConversationState = {
      lastManagerId: number | null;
      pendingOwnerId: number | null;
      pendingTodayCount: number;
    };
    const avitoStateMap = new Map<string, AvitoConversationState>();
    const ensureAvitoState = (chatKey: string) => {
      const existing = avitoStateMap.get(chatKey);
      if (existing) return existing;
      const created: AvitoConversationState = {
        lastManagerId: null,
        pendingOwnerId: null,
        pendingTodayCount: 0,
      };
      avitoStateMap.set(chatKey, created);
      return created;
    };

    for (const event of avitoEvents) {
      const state = ensureAvitoState(event.chatKey);
      if (event.type === 'REPLY') {
        if (event.employeeId) {
          state.lastManagerId = event.employeeId;
          state.pendingOwnerId = null;
          state.pendingTodayCount = 0;
        }
        continue;
      }

      if (this.isSameMoscowDay(event.at, todayMoscowKey) && state.lastManagerId) {
        state.pendingOwnerId = state.lastManagerId;
        state.pendingTodayCount += 1;
      }
    }

    for (const state of avitoStateMap.values()) {
      if (state.pendingOwnerId && state.pendingTodayCount > 0) {
        increment(state.pendingOwnerId, state.pendingTodayCount);
      }
    }

    return unresolvedMap;
  }

  private async getEarningsForPeriod(employeeId: number, period: EmployeePeriod) {
    const range = this.getPeriodRange(period);
    const [shiftCount, salesAgg] = await Promise.all([
      this.prisma.employeeShift.count({
        where: {
          employeeId,
          startedAt: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.employeeSaleCredit.aggregate({
        where: {
          employeeId,
          creditedAt: { gte: range.from, lte: range.to },
        },
        _sum: {
          quantity: true,
          amount: true,
        },
      }),
    ]);

    const soldConsolesCount = Number(salesAgg?._sum?.quantity || 0);
    const salesBonusIncome = Number(salesAgg?._sum?.amount || 0);
    const shiftIncome = shiftCount * SHIFT_BASE_RATE_RUB;
    const totalIncome = shiftIncome + salesBonusIncome;

    return {
      period,
      rates: {
        shift: SHIFT_BASE_RATE_RUB,
        saleBonus: CONSOLE_SALE_BONUS_RUB,
      },
      shiftsCount: shiftCount,
      soldConsolesCount,
      shiftIncome: Number(shiftIncome.toFixed(2)),
      salesBonusIncome: Number(salesBonusIncome.toFixed(2)),
      totalIncome: Number(totalIncome.toFixed(2)),
    };
  }

  private async buildChatPerformance(
    employeeIds: number[],
    range: { from: Date; to: Date },
  ): Promise<ChatPerformanceStats> {
    const answeredChats = new Map<number, Set<string>>();
    const responseMinutes = new Map<number, { total: number; count: number }>();
    const trackAnsweredChat = (employeeId: number, chatKey: string) => {
      if (!employeeId || !chatKey) return;
      const set = answeredChats.get(employeeId) || new Set<string>();
      set.add(chatKey);
      answeredChats.set(employeeId, set);
    };
    const trackResponse = (employeeId: number, incomingAt: Date, replyAt: Date) => {
      if (!employeeId) return;
      if (!this.isWorkWindowPair(incomingAt, replyAt)) return;
      const minutes = Math.max(0, Math.round((replyAt.getTime() - incomingAt.getTime()) / 60000));
      const current = responseMinutes.get(employeeId) || { total: 0, count: 0 };
      current.total += minutes;
      current.count += 1;
      responseMinutes.set(employeeId, current);
    };

    if (!employeeIds.length) {
      return {
        answeredChats: new Map<number, number>(),
        responseMinutes,
      };
    }

    const [websiteLogs, avitoIncomingLogs, avitoReplyLogs] = await Promise.all([
      this.prisma.clientCommunicationLog.findMany({
        where: {
          channel: CommunicationChannel.WEBSITE,
          sentAt: {
            gte: subDays(range.from, 1),
            lte: range.to,
          },
          OR: [{ createdById: { in: employeeIds } }, { createdById: null }],
        },
        select: {
          clientId: true,
          createdById: true,
          sentAt: true,
        },
        orderBy: [{ clientId: 'asc' }, { sentAt: 'asc' }],
      }),
      this.prisma.auditLog.findMany({
        where: {
          action: 'AVITO_CHAT_INCOMING',
          createdAt: {
            gte: subDays(range.from, 1),
            lte: range.to,
          },
        },
        select: {
          createdAt: true,
          newData: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        where: {
          action: 'AVITO_CHAT_REPLY_SENT',
          createdAt: {
            gte: range.from,
            lte: range.to,
          },
          userId: { in: employeeIds },
        },
        select: {
          userId: true,
          createdAt: true,
          newData: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const websitePendingByClient = new Map<number, Date | null>();
    for (const log of websiteLogs) {
      if (!log.createdById) {
        websitePendingByClient.set(log.clientId, log.sentAt);
        continue;
      }

      const employeeId = Number(log.createdById);
      if (!employeeIds.includes(employeeId)) continue;
      if (log.sentAt < range.from || log.sentAt > range.to) continue;

      const chatKey = `website:${log.clientId}`;
      trackAnsweredChat(employeeId, chatKey);

      const pendingAt = websitePendingByClient.get(log.clientId);
      if (!pendingAt) continue;

      trackResponse(employeeId, pendingAt, log.sentAt);
      websitePendingByClient.set(log.clientId, null);
    }

    const incomingQueues = new Map<string, Date[]>();
    for (const log of avitoIncomingLogs) {
      const payload = (log.newData || {}) as Record<string, any>;
      const chatKey = this.parseAvitoChatKey(payload.chatKey);
      if (!chatKey) continue;
      const incomingAt = this.safeDate(payload.messageAt) || log.createdAt;
      const queue = incomingQueues.get(chatKey) || [];
      queue.push(incomingAt);
      incomingQueues.set(chatKey, queue);
    }

    for (const log of avitoReplyLogs) {
      const employeeId = Number(log.userId || 0);
      if (!employeeId) continue;

      const payload = (log.newData || {}) as Record<string, any>;
      const chatKey = this.parseAvitoChatKey(payload.chatKey);
      if (!chatKey) continue;
      const replyAt = this.safeDate(payload.sentAt) || log.createdAt;
      if (replyAt < range.from || replyAt > range.to) continue;

      trackAnsweredChat(employeeId, chatKey);

      const queue = incomingQueues.get(chatKey) || [];
      let pendingAt: Date | null = null;
      while (queue.length) {
        const candidate = queue[0];
        if (candidate.getTime() <= replyAt.getTime()) {
          pendingAt = queue.shift() || null;
          break;
        }
        break;
      }
      if (pendingAt) {
        trackResponse(employeeId, pendingAt, replyAt);
      }
      incomingQueues.set(chatKey, queue);
    }

    return {
      answeredChats: new Map(
        Array.from(answeredChats.entries()).map(([employeeId, chats]) => [employeeId, chats.size]),
      ),
      responseMinutes,
    };
  }

  async me(id?: number) {
    if (!id || Number.isNaN(id)) {
      throw new UnauthorizedException('User is not authenticated');
    }

    return this.prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        role: true,
        position: true,
        login: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
      },
    });
  }

  async metrics(userId: number | undefined, rawPeriod: 'today' | 'week' | 'month' | 'year') {
    const employee = await this.assertActiveEmployee(userId);
    const employeeId = employee.id;

    const period = this.normalizePeriod(rawPeriod);
    const range = this.getPeriodRange(period);

    const [
      completedLogs,
      activeCount,
      queueCount,
      messageCount,
      dealsCreated,
      chatPerformance,
      unansweredMap,
      shiftState,
      earnings,
    ] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          userId: employeeId,
          action: 'ORDER_STATUS_CHANGED',
          createdAt: { gte: range.from, lte: range.to },
        },
        select: {
          userId: true,
          entityId: true,
          newData: true,
        },
      }),
      this.prisma.order.count({
        where: { managerId: employeeId, status: { in: ['NEW', 'IN_PROGRESS'] } },
      }),
      this.prisma.order.count({
        where: { status: 'NEW', managerId: null },
      }),
      this.prisma.clientCommunicationLog.count({
        where: {
          createdById: employeeId,
          sentAt: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.order.count({
        where: {
          createdById: employeeId,
          date: { gte: range.from, lte: range.to },
        },
      }),
      this.buildChatPerformance([employeeId], range),
      this.computeTodayUnansweredByEmployees([employeeId]),
      this.getShiftSnapshot(employeeId),
      this.getEarningsForPeriod(employeeId, period),
    ]);

    const completedStats = await this.buildCompletedOrderStats(completedLogs);
    const response = chatPerformance.responseMinutes.get(employeeId) || { total: 0, count: 0 };
    const closed = completedStats.get(employeeId) || { count: 0, revenue: 0, profit: 0 };

    return {
      period,
      closedCount: closed.count,
      revenue: Number(closed.revenue.toFixed(2)),
      profit: Number(closed.profit.toFixed(2)),
      activeCount,
      queueCount,
      messageCount,
      dealsCreated,
      answeredChats: chatPerformance.answeredChats.get(employeeId) || 0,
      averageResponseMinutes:
        response.count > 0 ? Number((response.total / response.count).toFixed(1)) : null,
      unansweredMessagesToday: unansweredMap.get(employeeId) || 0,
      shiftStartedAt: shiftState.todayShiftStartedAt,
      shiftEndedAt: shiftState.todayShiftEndedAt,
      isOnShift: shiftState.isOnShift,
      shiftsCount: earnings.shiftsCount,
      soldConsolesCount: earnings.soldConsolesCount,
      shiftIncome: earnings.shiftIncome,
      salesBonusIncome: earnings.salesBonusIncome,
      totalIncome: earnings.totalIncome,
    };
  }

  async meShift(userId: number | undefined) {
    const employee = await this.assertActiveEmployee(userId);
    return this.getShiftSnapshot(employee.id);
  }

  async startShift(userId: number | undefined) {
    const employee = await this.assertActiveEmployee(userId);
    const current = await this.prisma.employeeShift.findFirst({
      where: {
        employeeId: employee.id,
        status: 'OPEN',
      },
      orderBy: [{ startedAt: 'desc' }],
    });

    if (current) {
      const snapshot = await this.getShiftSnapshot(employee.id);
      return {
        success: true,
        alreadyStarted: true,
        ...snapshot,
      };
    }

    const shift = await this.prisma.employeeShift.create({
      data: {
        employeeId: employee.id,
        startedById: employee.id,
        status: 'OPEN',
      },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        status: true,
      },
    });

    await this.writeAuditLog(employee.id, 'EMPLOYEE_SHIFT_STARTED', 'EMPLOYEE_SHIFT', shift.id, {
      employeeId: employee.id,
      startedAt: shift.startedAt.toISOString(),
    });

    const snapshot = await this.getShiftSnapshot(employee.id);
    return {
      success: true,
      alreadyStarted: false,
      shift: {
        ...shift,
        startedAt: shift.startedAt.toISOString(),
        endedAt: shift.endedAt ? shift.endedAt.toISOString() : null,
      },
      ...snapshot,
    };
  }

  async endShift(userId: number | undefined) {
    const employee = await this.assertActiveEmployee(userId);
    const current = await this.prisma.employeeShift.findFirst({
      where: {
        employeeId: employee.id,
        status: 'OPEN',
      },
      orderBy: [{ startedAt: 'desc' }],
      select: {
        id: true,
        employeeId: true,
        startedAt: true,
      },
    });

    if (!current) {
      throw new BadRequestException('Смена не начата');
    }

    const finished = await this.prisma.employeeShift.update({
      where: { id: current.id },
      data: {
        status: 'CLOSED',
        endedAt: new Date(),
        endedById: employee.id,
      },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        status: true,
      },
    });

    await this.writeAuditLog(employee.id, 'EMPLOYEE_SHIFT_ENDED', 'EMPLOYEE_SHIFT', finished.id, {
      employeeId: employee.id,
      startedAt: current.startedAt.toISOString(),
      endedAt: finished.endedAt ? finished.endedAt.toISOString() : null,
    });

    const snapshot = await this.getShiftSnapshot(employee.id);
    return {
      success: true,
      shift: {
        ...finished,
        startedAt: finished.startedAt.toISOString(),
        endedAt: finished.endedAt ? finished.endedAt.toISOString() : null,
      },
      ...snapshot,
    };
  }

  async meEarnings(userId: number | undefined, rawPeriod: 'today' | 'week' | 'month' | 'year') {
    const employee = await this.assertActiveEmployee(userId);
    const period = this.normalizePeriod(rawPeriod);
    return this.getEarningsForPeriod(employee.id, period);
  }

  async adminCompletedOrders(limit: number, q?: string, user?: AdminUser) {
    this.assertAdminAnalyticsAccess(user);

    const normalizedLimit = Math.min(Math.max(Number(limit) || 60, 10), 200);
    const search = String(q || '').trim();
    const numericId = Number(search);

    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.COMPLETED,
        ...(search
          ? {
              OR: [
                ...(Number.isFinite(numericId) && numericId > 0 ? [{ id: numericId }] : []),
                { client: { name: { contains: search, mode: 'insensitive' } } },
                { client: { phone: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        date: true,
        totalPrice: true,
        managerId: true,
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: normalizedLimit,
    });

    return {
      items: orders.map(order => ({
        id: order.id,
        date: order.date.toISOString(),
        totalPrice: Number(order.totalPrice || 0),
        managerId: order.managerId || null,
        clientName: order.client?.name || null,
        clientPhone: order.client?.phone || null,
      })),
      limit: normalizedLimit,
    };
  }

  async addSalesCredit(
    payload: {
      employeeId: number;
      orderId?: number | null;
      quantity?: number;
      note?: string;
      amount?: number;
    },
    user?: AdminUser,
  ) {
    this.assertAdminAnalyticsAccess(user);

    const employeeId = Number(payload?.employeeId || 0);
    if (!employeeId || Number.isNaN(employeeId)) {
      throw new BadRequestException('Некорректный сотрудник');
    }

    const quantity = Math.max(1, Math.floor(Number(payload?.quantity || 1)));
    const orderId = payload?.orderId == null ? null : Number(payload.orderId);
    const trimmedNote = String(payload?.note || '').trim();
    const note = trimmedNote ? trimmedNote.slice(0, 500) : null;

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        role: true,
        isActive: true,
        name: true,
        login: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Сотрудник не найден');
    }
    if (employee.role !== Role.MANAGER) {
      throw new BadRequestException('Начисление за продажу доступно только менеджерам');
    }

    let source: 'ORDER' | 'MANUAL' = 'MANUAL';
    let linkedOrder: { id: number; status: OrderStatus } | null = null;

    if (orderId) {
      linkedOrder = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
        },
      });
      if (!linkedOrder) {
        throw new NotFoundException('Заказ не найден');
      }
      if (linkedOrder.status !== OrderStatus.COMPLETED) {
        throw new BadRequestException('Привязать можно только завершённый заказ');
      }
      source = 'ORDER';
    }

    const rawAmount = Number(payload?.amount);
    const resolvedAmount =
      Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : quantity * CONSOLE_SALE_BONUS_RUB;

    try {
      const credit = await this.prisma.employeeSaleCredit.create({
        data: {
          employeeId,
          source,
          orderId: linkedOrder?.id || null,
          quantity,
          amount: new Prisma.Decimal(resolvedAmount.toFixed(2)),
          note,
          createdById: Number(user?.id || 0) || null,
        },
        select: {
          id: true,
          employeeId: true,
          source: true,
          orderId: true,
          quantity: true,
          amount: true,
          note: true,
          creditedAt: true,
        },
      });

      await this.writeAuditLog(user?.id, 'EMPLOYEE_SALE_CREDIT_ADDED', 'EMPLOYEE', employeeId, {
        employeeId,
        orderId: credit.orderId,
        source: credit.source,
        quantity: credit.quantity,
        amount: Number(credit.amount || 0),
        note,
      });

      return {
        success: true,
        credit: {
          ...credit,
          amount: Number(credit.amount || 0),
          creditedAt: credit.creditedAt.toISOString(),
        },
      };
    } catch (error: any) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        orderId
      ) {
        throw new BadRequestException('По этому заказу уже есть начисление менеджеру');
      }
      throw error;
    }
  }

  async adminOverview(rawPeriod: string | undefined, includeInactive: boolean, user?: AdminUser) {
    this.assertAdminAnalyticsAccess(user);

    const period = this.normalizePeriod(rawPeriod);
    const range = this.getPeriodRange(period);

    const allEmployees = await this.prisma.employee.findMany({
      where: includeInactive ? undefined : { isActive: true },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        login: true,
        role: true,
        position: true,
        phone: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
    const employees = allEmployees.filter(employee => !this.isHiddenEmployeeProfile(employee));

    if (!employees.length) {
      return { period, employees: [], totals: { active: 0, inactive: 0 } };
    }

    const employeeIds = employees.map(employee => employee.id);
    const now = new Date();
    const todayMoscowKey = this.moscowDateParts(now).dayKey;
    const todayScanFrom = subDays(startOfDay(now), 2);
    const todayScanTo = endOfDay(now);
    const unresolvedScanFrom = subDays(todayScanFrom, 7);

    const [
      orders,
      activeOrders,
      tasks,
      logins,
      messages,
      statusLogs,
      chatPerformance,
      dayLogins,
      dayWebsiteLogs,
      dayAvitoIncomingLogs,
      dayAvitoReplyLogs,
      dayOrderStatusLogs,
      dayCreatedOrders,
      periodShifts,
      todayShifts,
      salesCredits,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          date: { gte: range.from, lte: range.to },
          OR: [{ createdById: { in: employeeIds } }, { managerId: { in: employeeIds } }],
        },
        select: {
          id: true,
          createdById: true,
          managerId: true,
          status: true,
          totalPrice: true,
          profit: true,
        },
      }),
      this.prisma.order.findMany({
        where: {
          managerId: { in: employeeIds },
          status: { in: [OrderStatus.NEW, OrderStatus.IN_PROGRESS] },
        },
        select: {
          id: true,
          managerId: true,
        },
      }),
      this.prisma.task.findMany({
        where: {
          assignedToId: { in: employeeIds },
          status: { in: [TaskStatus.NEW, TaskStatus.IN_PROGRESS] },
        },
        select: {
          id: true,
          assignedToId: true,
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          userId: { in: employeeIds },
          action: 'AUTH_LOGIN',
          createdAt: { gte: range.from, lte: range.to },
        },
        select: {
          userId: true,
          createdAt: true,
        },
      }),
      this.prisma.clientCommunicationLog.findMany({
        where: {
          createdById: { in: employeeIds },
          sentAt: { gte: range.from, lte: range.to },
        },
        select: {
          id: true,
          clientId: true,
          createdById: true,
          sentAt: true,
          channel: true,
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          userId: { in: employeeIds },
          action: 'ORDER_STATUS_CHANGED',
          createdAt: { gte: range.from, lte: range.to },
        },
        select: {
          userId: true,
          newData: true,
        },
      }),
      this.buildChatPerformance(employeeIds, range),
      this.prisma.auditLog.findMany({
        where: {
          userId: { in: employeeIds },
          action: 'AUTH_LOGIN',
          createdAt: { gte: todayScanFrom, lte: todayScanTo },
        },
        select: {
          userId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.clientCommunicationLog.findMany({
        where: {
          channel: CommunicationChannel.WEBSITE,
          sentAt: { gte: unresolvedScanFrom, lte: todayScanTo },
          OR: [{ createdById: { in: employeeIds } }, { createdById: null }],
        },
        select: {
          clientId: true,
          createdById: true,
          sentAt: true,
        },
        orderBy: [{ clientId: 'asc' }, { sentAt: 'asc' }],
      }),
      this.prisma.auditLog.findMany({
        where: {
          action: 'AVITO_CHAT_INCOMING',
          createdAt: { gte: unresolvedScanFrom, lte: todayScanTo },
        },
        select: {
          createdAt: true,
          newData: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        where: {
          action: 'AVITO_CHAT_REPLY_SENT',
          userId: { in: employeeIds },
          createdAt: { gte: unresolvedScanFrom, lte: todayScanTo },
        },
        select: {
          userId: true,
          createdAt: true,
          newData: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        where: {
          action: 'ORDER_STATUS_CHANGED',
          userId: { in: employeeIds },
          createdAt: { gte: todayScanFrom, lte: todayScanTo },
        },
        select: {
          userId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.order.findMany({
        where: {
          createdById: { in: employeeIds },
          date: { gte: todayScanFrom, lte: todayScanTo },
        },
        select: {
          createdById: true,
          date: true,
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.employeeShift.findMany({
        where: {
          employeeId: { in: employeeIds },
          startedAt: { gte: range.from, lte: range.to },
        },
        select: {
          employeeId: true,
          startedAt: true,
          endedAt: true,
          status: true,
        },
      }),
      this.prisma.employeeShift.findMany({
        where: {
          employeeId: { in: employeeIds },
          OR: [
            { status: 'OPEN' },
            { startedAt: { gte: todayScanFrom, lte: todayScanTo } },
            { endedAt: { gte: todayScanFrom, lte: todayScanTo } },
          ],
        },
        select: {
          employeeId: true,
          startedAt: true,
          endedAt: true,
          status: true,
        },
      }),
      this.prisma.employeeSaleCredit.findMany({
        where: {
          employeeId: { in: employeeIds },
          creditedAt: { gte: range.from, lte: range.to },
        },
        select: {
          employeeId: true,
          quantity: true,
          amount: true,
        },
      }),
    ]);

    const ordersCreatedMap = new Map<number, number>();
    const ordersCompletedMap = await this.buildCompletedOrderStats(statusLogs);
    const activeOrdersMap = new Map<number, number>();
    const taskLoadMap = new Map<number, number>();
    const loginCountMap = new Map<number, number>();
    const messageCountMap = new Map<number, number>();
    const ordersStartedMap = new Map<number, number>();
    const responseMinutesMap = chatPerformance.responseMinutes;
    const shiftStartMap = new Map<number, Date>();
    const shiftEndMap = new Map<number, Date>();
    const unansweredMessagesTodayMap = new Map<number, number>();
    const periodShiftCountMap = new Map<number, number>();
    const soldConsolesMap = new Map<number, number>();
    const salesBonusIncomeMap = new Map<number, number>();
    const explicitShiftStartMap = new Map<number, Date>();
    const explicitShiftEndMap = new Map<number, Date>();
    const explicitOpenShiftMap = new Map<number, boolean>();

    const isTodayMoscow = (value: unknown) => {
      const date = this.safeDate(value);
      return Boolean(date && this.isSameMoscowDay(date, todayMoscowKey));
    };
    const setMinDate = (map: Map<number, Date>, employeeId: number, value: Date) => {
      const current = map.get(employeeId);
      if (!current || value.getTime() < current.getTime()) {
        map.set(employeeId, value);
      }
    };
    const setMaxDate = (map: Map<number, Date>, employeeId: number, value: Date) => {
      const current = map.get(employeeId);
      if (!current || value.getTime() > current.getTime()) {
        map.set(employeeId, value);
      }
    };
    const incrementUnanswered = (employeeId: number, count = 1) => {
      if (!employeeId || !employeeIds.includes(employeeId) || count <= 0) return;
      unansweredMessagesTodayMap.set(
        employeeId,
        (unansweredMessagesTodayMap.get(employeeId) || 0) + count,
      );
    };

    for (const shift of periodShifts) {
      const employeeId = Number(shift.employeeId || 0);
      if (!employeeId) continue;
      periodShiftCountMap.set(employeeId, (periodShiftCountMap.get(employeeId) || 0) + 1);
    }

    for (const credit of salesCredits) {
      const employeeId = Number(credit.employeeId || 0);
      if (!employeeId) continue;
      soldConsolesMap.set(
        employeeId,
        (soldConsolesMap.get(employeeId) || 0) + Number(credit.quantity || 0),
      );
      salesBonusIncomeMap.set(
        employeeId,
        (salesBonusIncomeMap.get(employeeId) || 0) + Number(credit.amount || 0),
      );
    }

    for (const order of orders) {
      if (order.createdById) {
        ordersCreatedMap.set(order.createdById, (ordersCreatedMap.get(order.createdById) || 0) + 1);
      }
    }

    for (const order of activeOrders) {
      if (!order.managerId) continue;
      activeOrdersMap.set(order.managerId, (activeOrdersMap.get(order.managerId) || 0) + 1);
    }

    for (const task of tasks) {
      taskLoadMap.set(task.assignedToId, (taskLoadMap.get(task.assignedToId) || 0) + 1);
    }

    for (const login of logins) {
      if (!login.userId) continue;
      loginCountMap.set(login.userId, (loginCountMap.get(login.userId) || 0) + 1);
    }

    for (const message of messages) {
      if (!message.createdById) continue;
      messageCountMap.set(message.createdById, (messageCountMap.get(message.createdById) || 0) + 1);
    }

    for (const log of statusLogs) {
      if (!log.userId) continue;
      const nextStatus = String((log.newData as any)?.status || '').toUpperCase();
      if (nextStatus === 'IN_PROGRESS') {
        ordersStartedMap.set(log.userId, (ordersStartedMap.get(log.userId) || 0) + 1);
      }
    }

    for (const login of dayLogins) {
      const employeeId = Number(login.userId || 0);
      if (!employeeId || !isTodayMoscow(login.createdAt)) continue;
      setMinDate(shiftStartMap, employeeId, login.createdAt);
      setMaxDate(shiftEndMap, employeeId, login.createdAt);
    }

    for (const log of dayOrderStatusLogs) {
      const employeeId = Number(log.userId || 0);
      if (!employeeId || !isTodayMoscow(log.createdAt)) continue;
      setMaxDate(shiftEndMap, employeeId, log.createdAt);
    }

    for (const order of dayCreatedOrders) {
      const employeeId = Number(order.createdById || 0);
      if (!employeeId || !isTodayMoscow(order.date)) continue;
      setMaxDate(shiftEndMap, employeeId, order.date);
    }

    for (const shift of todayShifts) {
      const employeeId = Number(shift.employeeId || 0);
      if (!employeeId) continue;

      const startedAt = this.safeDate(shift.startedAt);
      const endedAt = this.safeDate(shift.endedAt);
      const startedToday = Boolean(startedAt && isTodayMoscow(startedAt));
      const endedToday = Boolean(endedAt && isTodayMoscow(endedAt));

      if (startedToday && startedAt) {
        setMinDate(explicitShiftStartMap, employeeId, startedAt);
      }

      if (endedToday && endedAt) {
        setMaxDate(explicitShiftEndMap, employeeId, endedAt);
        if (!startedToday && startedAt) {
          setMinDate(explicitShiftStartMap, employeeId, startedAt);
        }
      }

      if (shift.status === 'OPEN') {
        explicitOpenShiftMap.set(employeeId, true);
        if (startedAt) {
          setMinDate(explicitShiftStartMap, employeeId, startedAt);
        }
      }
    }

    type WebsiteConversationTodayState = {
      lastManagerId: number | null;
      pendingOwnerId: number | null;
      pendingTodayCount: number;
    };
    const websiteTodayState = new Map<number, WebsiteConversationTodayState>();
    const ensureWebsiteTodayState = (clientId: number) => {
      const existing = websiteTodayState.get(clientId);
      if (existing) return existing;
      const created: WebsiteConversationTodayState = {
        lastManagerId: null,
        pendingOwnerId: null,
        pendingTodayCount: 0,
      };
      websiteTodayState.set(clientId, created);
      return created;
    };

    for (const log of dayWebsiteLogs) {
      const clientId = Number(log.clientId || 0);
      if (!clientId) continue;
      const state = ensureWebsiteTodayState(clientId);
      const managerId = Number(log.createdById || 0);
      if (managerId) {
        state.lastManagerId = managerId;
        state.pendingOwnerId = null;
        state.pendingTodayCount = 0;
        if (isTodayMoscow(log.sentAt)) {
          setMaxDate(shiftEndMap, managerId, log.sentAt);
        }
        continue;
      }

      if (isTodayMoscow(log.sentAt) && state.lastManagerId) {
        state.pendingOwnerId = state.lastManagerId;
        state.pendingTodayCount += 1;
      }
    }

    for (const state of websiteTodayState.values()) {
      if (state.pendingOwnerId && state.pendingTodayCount > 0) {
        incrementUnanswered(state.pendingOwnerId, state.pendingTodayCount);
      }
    }

    type AvitoEvent = {
      chatKey: string;
      at: Date;
      type: 'INCOMING' | 'REPLY';
      employeeId: number | null;
    };
    const avitoEvents: AvitoEvent[] = [];

    for (const log of dayAvitoIncomingLogs) {
      const payload = (log.newData || {}) as Record<string, any>;
      const chatKey = this.parseAvitoChatKey(payload.chatKey);
      if (!chatKey) continue;
      const incomingAt = this.safeDate(payload.messageAt) || log.createdAt;
      avitoEvents.push({
        chatKey,
        at: incomingAt,
        type: 'INCOMING',
        employeeId: null,
      });
    }

    for (const log of dayAvitoReplyLogs) {
      const employeeId = Number(log.userId || 0);
      if (!employeeId) continue;
      const payload = (log.newData || {}) as Record<string, any>;
      const chatKey = this.parseAvitoChatKey(payload.chatKey);
      if (!chatKey) continue;
      const replyAt = this.safeDate(payload.sentAt) || log.createdAt;
      avitoEvents.push({
        chatKey,
        at: replyAt,
        type: 'REPLY',
        employeeId,
      });
      if (isTodayMoscow(replyAt)) {
        setMaxDate(shiftEndMap, employeeId, replyAt);
      }
    }

    avitoEvents.sort((left, right) => left.at.getTime() - right.at.getTime());

    type AvitoChatTodayState = {
      lastManagerId: number | null;
      pendingOwnerId: number | null;
      pendingTodayCount: number;
    };
    const avitoTodayState = new Map<string, AvitoChatTodayState>();
    const ensureAvitoTodayState = (chatKey: string) => {
      const existing = avitoTodayState.get(chatKey);
      if (existing) return existing;
      const created: AvitoChatTodayState = {
        lastManagerId: null,
        pendingOwnerId: null,
        pendingTodayCount: 0,
      };
      avitoTodayState.set(chatKey, created);
      return created;
    };

    for (const event of avitoEvents) {
      const state = ensureAvitoTodayState(event.chatKey);
      if (event.type === 'REPLY') {
        if (event.employeeId) {
          state.lastManagerId = event.employeeId;
          state.pendingOwnerId = null;
          state.pendingTodayCount = 0;
        }
        continue;
      }
      if (isTodayMoscow(event.at) && state.lastManagerId) {
        state.pendingOwnerId = state.lastManagerId;
        state.pendingTodayCount += 1;
      }
    }

    for (const state of avitoTodayState.values()) {
      if (state.pendingOwnerId && state.pendingTodayCount > 0) {
        incrementUnanswered(state.pendingOwnerId, state.pendingTodayCount);
      }
    }

    return {
      period,
      totals: {
        active: employees.filter(employee => employee.isActive).length,
        inactive: employees.filter(employee => !employee.isActive).length,
      },
      employees: employees.map(employee => {
        const closed = ordersCompletedMap.get(employee.id) || {
          count: 0,
          revenue: 0,
          profit: 0,
        };
        const response = responseMinutesMap.get(employee.id) || { total: 0, count: 0 };
        const inferredShiftStart = shiftStartMap.get(employee.id) || null;
        const inferredShiftEnd = shiftEndMap.get(employee.id) || null;
        const explicitShiftStart = explicitShiftStartMap.get(employee.id) || null;
        const explicitShiftEnd = explicitShiftEndMap.get(employee.id) || null;
        const hasOpenShift = Boolean(explicitOpenShiftMap.get(employee.id));
        const shiftStart = explicitShiftStart || inferredShiftStart || inferredShiftEnd || null;
        const shiftEnd = explicitShiftStart
          ? hasOpenShift
            ? null
            : explicitShiftEnd || inferredShiftEnd || null
          : inferredShiftEnd || inferredShiftStart || null;
        const shiftsCount = periodShiftCountMap.get(employee.id) || 0;
        const soldConsolesCount = soldConsolesMap.get(employee.id) || 0;
        const salesBonusIncome = Number((salesBonusIncomeMap.get(employee.id) || 0).toFixed(2));
        const shiftIncome = Number((shiftsCount * SHIFT_BASE_RATE_RUB).toFixed(2));
        const totalIncome = Number((shiftIncome + salesBonusIncome).toFixed(2));

        return {
          ...employee,
          phone: this.normalizePhone(employee.phone) || employee.phone,
          stats: {
            loginCount: loginCountMap.get(employee.id) || 0,
            ordersCreated: ordersCreatedMap.get(employee.id) || 0,
            ordersStarted: ordersStartedMap.get(employee.id) || 0,
            ordersCompleted: closed.count,
            revenue: Number(closed.revenue.toFixed(2)),
            profit: Number(closed.profit.toFixed(2)),
            activeOrders: activeOrdersMap.get(employee.id) || 0,
            taskLoad: taskLoadMap.get(employee.id) || 0,
            messagesSent: messageCountMap.get(employee.id) || 0,
            answeredChats: chatPerformance.answeredChats.get(employee.id) || 0,
            averageResponseMinutes:
              response.count > 0 ? Number((response.total / response.count).toFixed(1)) : null,
            unansweredMessagesToday: unansweredMessagesTodayMap.get(employee.id) || 0,
            shiftStartedAt: shiftStart ? shiftStart.toISOString() : null,
            shiftEndedAt: shiftEnd ? shiftEnd.toISOString() : null,
            shiftsCount,
            soldConsolesCount,
            shiftIncome,
            salesBonusIncome,
            totalIncome,
          },
        };
      }),
    };
  }

  async adminActivity(
    rawPeriod: string | undefined,
    employeeId: number | undefined,
    user?: AdminUser,
  ) {
    this.assertAdminAnalyticsAccess(user);

    const period = this.normalizePeriod(rawPeriod);
    const range = this.getPeriodRange(period);
    const employeeFilter = employeeId && !Number.isNaN(employeeId) ? employeeId : null;

    const [loginEvents, orderCreatedEvents, statusEvents, messageEvents] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          action: 'AUTH_LOGIN',
          createdAt: { gte: range.from, lte: range.to },
          ...(employeeFilter ? { userId: employeeFilter } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          userId: true,
          createdAt: true,
          user: {
            select: { id: true, name: true, login: true, role: true },
          },
        },
      }),
      this.prisma.order.findMany({
        where: employeeFilter
          ? { createdById: employeeFilter, date: { gte: range.from, lte: range.to } }
          : { date: { gte: range.from, lte: range.to } },
        orderBy: { date: 'desc' },
        take: 100,
        select: {
          id: true,
          date: true,
          createdById: true,
          status: true,
          client: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, login: true, role: true } },
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          action: { in: ['ORDER_STATUS_CHANGED', 'ORDER_RESERVE_EXTENDED'] },
          createdAt: { gte: range.from, lte: range.to },
          ...(employeeFilter ? { userId: employeeFilter } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 150,
        select: {
          id: true,
          action: true,
          userId: true,
          entityId: true,
          createdAt: true,
          newData: true,
          user: {
            select: { id: true, name: true, login: true, role: true },
          },
        },
      }),
      this.prisma.clientCommunicationLog.findMany({
        where: {
          sentAt: { gte: range.from, lte: range.to },
          createdById: employeeFilter ? employeeFilter : { not: null },
        },
        orderBy: { sentAt: 'desc' },
        take: 150,
        include: {
          createdBy: {
            select: { id: true, name: true, login: true, role: true },
          },
          client: {
            select: { id: true, name: true, phone: true },
          },
        },
      }),
    ]);

    const activity = [
      ...loginEvents.map(event => ({
        id: `login-${event.id}`,
        timestamp: event.createdAt,
        employeeId: event.userId,
        employee: event.user,
        kind: 'AUTH_LOGIN',
        title: `${event.user?.name || event.user?.login || 'Сотрудник'} вошёл в CRM`,
        description: 'Успешный вход в учётную запись CRM',
      })),
      ...orderCreatedEvents.map(event => ({
        id: `order-created-${event.id}`,
        timestamp: event.date,
        employeeId: event.createdById,
        employee: event.createdBy,
        kind: 'ORDER_CREATED',
        title: `${event.createdBy?.name || event.createdBy?.login || 'Сотрудник'} создал заказ #${event.id}`,
        description: `Клиент: ${event.client?.name || 'без имени'}`,
      })),
      ...statusEvents.map(event => {
        const nextStatus = String((event.newData as any)?.status || '').toUpperCase();
        const orderId = (event.entityId || (event.newData as any)?.orderId || 0) as number;
        if (event.action === 'ORDER_RESERVE_EXTENDED') {
          const minutes = Number((event.newData as any)?.minutes || 0);
          const reserveUntil = String((event.newData as any)?.reserveUntil || '');
          return {
            id: `order-reserve-${event.id}`,
            timestamp: event.createdAt,
            employeeId: event.userId,
            employee: event.user,
            kind: 'ORDER_RESERVE_EXTENDED',
            title: `${event.user?.name || event.user?.login || 'Сотрудник'} продлил бронь заказа #${orderId}`,
            description: `${minutes || 'Несколько'} мин. до ${reserveUntil ? new Date(reserveUntil).toLocaleString('ru-RU') : 'нового дедлайна'}`,
          };
        }
        const ruStatus =
          nextStatus === 'IN_PROGRESS'
            ? 'в работе'
            : nextStatus === 'COMPLETED'
              ? 'завершён'
              : nextStatus === 'CANCELED'
                ? 'отменён'
                : nextStatus || 'обновлён';

        return {
          id: `order-status-${event.id}`,
          timestamp: event.createdAt,
          employeeId: event.userId,
          employee: event.user,
          kind: 'ORDER_STATUS_CHANGED',
          title: `${event.user?.name || event.user?.login || 'Сотрудник'} обновил заказ #${orderId}`,
          description: `Новый статус: ${ruStatus}`,
        };
      }),
      ...messageEvents.map(event => ({
        id: `message-${event.id}`,
        timestamp: event.sentAt,
        employeeId: event.createdById,
        employee: event.createdBy,
        kind: 'MESSAGE_SENT',
        title: `${event.createdBy?.name || event.createdBy?.login || 'Сотрудник'} ответил клиенту`,
        description: `${event.client?.name || event.client?.phone || 'Клиент'} • канал ${event.channel}`,
      })),
    ]
      .filter(item => !this.isHiddenEmployeeProfile(item.employee))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 200);

    return {
      period,
      activity,
    };
  }

  async createEmployee(
    body: {
      login: string;
      password: string;
      firstName?: string;
      lastName?: string;
      name?: string;
      phone?: string;
      role?: Role;
      position?: Position;
    },
    user?: AdminUser,
  ) {
    this.assertSuperAdmin(user);

    const login = String(body.login || '').trim();
    const password = String(body.password || '').trim();
    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    const explicitName = String(body.name || '').trim();
    const fullName =
      explicitName || [firstName, lastName].filter(Boolean).join(' ').trim() || login;
    const normalizedPhone = this.normalizePhone(body.phone);
    const role =
      body.role && ['MANAGER', 'TECHNICAL_SPECIALIST', 'SUPER_ADMIN'].includes(body.role)
        ? body.role
        : Role.MANAGER;
    const position = body.position || this.defaultPositionByRole(role);

    if (!login || login.length < 3) {
      throw new BadRequestException('Логин должен содержать минимум 3 символа');
    }

    if (!password || password.length < 6) {
      throw new BadRequestException('Пароль должен содержать минимум 6 символов');
    }

    const existing = await this.prisma.employee.findFirst({
      where: {
        OR: [{ login }, ...(normalizedPhone ? [{ phone: normalizedPhone }] : [])],
      },
      select: { id: true, login: true, phone: true },
    });

    if (existing?.login === login) {
      throw new BadRequestException('Сотрудник с таким логином уже существует');
    }

    if (normalizedPhone && existing?.phone === normalizedPhone) {
      throw new BadRequestException('Сотрудник с таким телефоном уже существует');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const employee = await this.prisma.employee.create({
      data: {
        login,
        passwordHash,
        name: fullName,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: normalizedPhone,
        role,
        position,
        tenant: role === Role.SUPER_ADMIN ? null : 'TECHNOPRIME',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        login: true,
        phone: true,
        role: true,
        position: true,
        isActive: true,
        createdAt: true,
      },
    });

    await this.writeAuditLog(user?.id, 'EMPLOYEE_CREATED', 'EMPLOYEE', employee.id, {
      login: employee.login,
      role: employee.role,
      position: employee.position,
    });

    return employee;
  }

  async deactivateEmployee(employeeId: number, user?: AdminUser) {
    this.assertSuperAdmin(user);

    if (!employeeId || Number.isNaN(employeeId)) {
      throw new BadRequestException('Некорректный employeeId');
    }

    if (employeeId === user?.id) {
      throw new BadRequestException('Нельзя деактивировать собственную учётную запись');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        login: true,
        role: true,
        isActive: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Сотрудник не найден');
    }

    if (!employee.isActive) {
      return { success: true, alreadyInactive: true };
    }

    if (employee.role === Role.SUPER_ADMIN) {
      const activeSuperAdmins = await this.prisma.employee.count({
        where: {
          role: Role.SUPER_ADMIN,
          isActive: true,
        },
      });

      if (activeSuperAdmins <= 1) {
        throw new BadRequestException('Нельзя отключить последнего активного супер-администратора');
      }
    }

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        isActive: false,
      },
    });

    await this.writeAuditLog(user?.id, 'EMPLOYEE_DEACTIVATED', 'EMPLOYEE', employee.id, {
      login: employee.login,
      role: employee.role,
      isActive: false,
    });

    return { success: true };
  }

  async restoreEmployee(employeeId: number, user?: AdminUser) {
    this.assertSuperAdmin(user);

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, login: true, role: true, isActive: true },
    });

    if (!employee) {
      throw new NotFoundException('Сотрудник не найден');
    }

    if (employee.isActive) {
      return { success: true, alreadyActive: true };
    }

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { isActive: true },
    });

    await this.writeAuditLog(user?.id, 'EMPLOYEE_RESTORED', 'EMPLOYEE', employee.id, {
      login: employee.login,
      role: employee.role,
      isActive: true,
    });

    return { success: true };
  }

  async createAdminIfEmpty() {
    const count = await this.prisma.employee.count();
    if (count !== 0) {
      return;
    }

    if (process.env.ALLOW_BOOTSTRAP_ADMIN !== 'true') {
      return;
    }

    const login = String(process.env.BOOTSTRAP_ADMIN_LOGIN || '').trim();
    const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '').trim();

    if (!login || !password) {
      throw new ServiceUnavailableException(
        'Bootstrap admin is enabled, but credentials are not configured',
      );
    }

    const hash = await bcrypt.hash(password, 12);
    await this.prisma.employee.create({
      data: {
        name: 'Bootstrap Admin',
        login,
        passwordHash: hash,
        role: 'SUPER_ADMIN',
        position: 'OWNER',
        isActive: true,
      },
    });
  }
}
