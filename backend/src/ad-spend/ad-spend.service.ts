import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma, AdSku } from '@prisma/client';
import Decimal from 'decimal.js';

function normalizeDate(dateStr?: string): Date {
  const d = dateStr ? new Date(dateStr) : new Date();
  const iso = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0));
  return iso;
}

@Injectable()
export class AdSpendService {
  constructor(private prisma: PrismaService) {}

  private money(v: any) {
    const d = v instanceof Decimal ? v : new Decimal(v || 0);
    return new Prisma.Decimal(d.toFixed(2));
  }

  async upsert(body: { date?: string; adSku: AdSku; amount: number; note?: string; createdById?: number }) {
    if (!body?.adSku) throw new BadRequestException('adSku required');
    const date = normalizeDate(body.date);
    const amount = this.money(body.amount || 0);
    const exist = await this.prisma.adSpend.findFirst({ where: { date, adSku: body.adSku } });
    if (exist) {
      return this.prisma.adSpend.update({
        where: { id: exist.id },
        data: { amount, note: body.note ?? exist.note },
      });
    }
    return this.prisma.adSpend.create({
      data: { date, adSku: body.adSku, amount, note: body.note ?? undefined, createdById: body.createdById ?? undefined },
    });
  }

  async list(query: { from?: string; to?: string; adSku?: AdSku }) {
    const from = query.from ? normalizeDate(query.from) : undefined;
    const to = query.to ? normalizeDate(query.to) : undefined;
    const where: Prisma.AdSpendWhereInput = {};
    if (query.adSku) where.adSku = query.adSku;
    if (from || to) where.date = { gte: from, lte: to };
    return this.prisma.adSpend.findMany({ where, orderBy: [{ date: 'asc' }, { adSku: 'asc' }] });
  }

  async remove(id: number) {
    return this.prisma.adSpend.delete({ where: { id } });
  }
}