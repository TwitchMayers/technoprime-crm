import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Tenant } from '@prisma/client';

@Injectable()
export class RichMarketClientsService {
  constructor(private prisma: PrismaService) {}

  async list(query?: { q?: string; limit?: string; page?: string }) {
    const page = Number(query?.page) || 1;
    const limit = Math.min(Number(query?.limit) || 50, 200);
    const skip = (page - 1) * limit;

    const where: any = {
      tenant: Tenant.RICHMARKET,
    };

    if (query?.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q, mode: 'insensitive' } },
        { address: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.richMarketClient.findMany({
        where,
        skip,
        take: limit,
        include: {  
          orders: {
            where: { status: 'COMPLETED'   } as any as any,
            take: 1,
            orderBy: { date: 'desc' },
          },
        },
        orderBy: { id: 'desc' },
      }),
      this.prisma.richMarketClient.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(data: {
    name: string;
    phone: string;
    city?: string;
    address?: string;
  }) {
    return this.prisma.richMarketClient.create({
      data: {
        tenant: Tenant.RICHMARKET,
        name: data.name,
        phone: data.phone,
        city: data.city,
        address: data.address,
      },
    });
  }

  async update(id: number, data: Partial<{
    name: string;
    phone: string;
    city: string;
    address: string;
  }>) {
    return this.prisma.richMarketClient.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    const client = await this.prisma.richMarketClient.findUnique({
      where: { id },
      include: {  
        orders: true,
        tasks: true,
        } as any as any,
    });

    if (!client) {
      throw new BadRequestException('Клиент не найден');
    }

    if (client.TechPrimeOrder.length > 0) {
      throw new BadRequestException(
        `Нельзя удалить клиента с ${client.TechPrimeOrder.length} заказами`
      );
    }

    await this.prisma.$transaction([
      this.prisma.richMarketTask.deleteMany({ where: { clientId: id } }),
      this.prisma.richMarketClient.delete({ where: { id } }),
    ]);

    return { success: true };
  }
}