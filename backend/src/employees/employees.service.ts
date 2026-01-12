import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async me(id?: number) {
    const select = {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      role: true,
      position: true,
      login: true,
    };
    if (!id || Number.isNaN(id)) {
      const first = await this.prisma.employee.findFirst({ orderBy: { id: 'asc' }, select });
      return first;
    }
    return this.prisma.employee.findUnique({ where: { id }, select });
  }

  async metrics(userId: number | undefined, period: 'today' | 'week' | 'month') {
    const uid = userId ?? 1;
    let range: any;
    if (period === 'today') {
      range = { gte: startOfDay(new Date()), lte: endOfDay(new Date()) };
    } else if (period === 'week') {
      range = { gte: startOfWeek(new Date(), { weekStartsOn: 1 }), lte: endOfWeek(new Date(), { weekStartsOn: 1 }) };
    } else {
      range = { gte: startOfMonth(new Date()), lte: endOfMonth(new Date()) };
    }

    const closed = await this.prisma.order.findMany({
      where: { managerId: uid, status: 'COMPLETED', date: range },
      select: { profit: true, totalPrice: true },
    });

    const activeCount = await this.prisma.order.count({
      where: { managerId: uid, status: { in: ['NEW', 'IN_PROGRESS'] } },
    });

    const queueCount = await this.prisma.order.count({
      where: { status: 'NEW', managerId: null },
    });

    const closedCount = closed.length;
    const revenue = closed.reduce((s, o) => s + Number(o.totalPrice), 0);
    const profit = closed.reduce((s, o) => s + Number(o.profit), 0);

    return { period, closedCount, revenue, profit, activeCount, queueCount };
  }

  async createAdminIfEmpty() {
    const count = await this.prisma.employee.count();
    if (count === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await this.prisma.employee.create({
        data: { name: 'Admin', login: 'admin', passwordHash: hash, role: 'SUPER_ADMIN', position: 'OWNER' },
      });
      console.log('Admin user created: login=admin, password=admin123');
    }
  }
}