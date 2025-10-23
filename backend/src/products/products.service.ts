import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async list(params: { isArchived?: boolean; q?: string; category?: string; page: number; limit: number }) {
    const where: any = {};
    if (typeof params.isArchived === 'boolean') where.isArchived = params.isArchived;
    if (params.category) where.category = params.category;
    if (params.q) {
      where.OR = [
        { name: { contains: params.q, mode: 'insensitive' } },
        { brand: { contains: params.q, mode: 'insensitive' } },
        { model: { contains: params.q, mode: 'insensitive' } },
        { version: { contains: params.q, mode: 'insensitive' } },
      ];
    }
    const skip = (params.page - 1) * params.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, orderBy: { id: 'desc' }, skip, take: params.limit }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page: params.page, limit: params.limit };
  }

  create(data: any) { return this.prisma.product.create({ data }); }

  archive(id: number, flag: boolean) {
    return this.prisma.product.update({
      where: { id },
      data: { isArchived: flag, archivedAt: flag ? new Date() : null },
    });
  }

  remove(id: number) {
    return this.prisma.product.delete({ where: { id } });
  }
}