// backend/src/clients/clients.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async list(params: { q?: string; city?: string; consoleType?: string; page: number; limit: number }) {
    const where: any = {};
    const AND: any[] = [];
    if (params.city) AND.push({ city: { contains: params.city, mode: 'insensitive' } });
    if (params.consoleType) AND.push({ consoleType: { contains: params.consoleType, mode: 'insensitive' } });
    if (params.q) {
      AND.push({
        OR: [
          { name: { contains: params.q, mode: 'insensitive' } },
          { phone: { contains: params.q, mode: 'insensitive' } },
          { address: { contains: params.q, mode: 'insensitive' } },
        ],
      });
    }
    if (AND.length) where.AND = AND;

    const skip = (params.page - 1) * params.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({ where, orderBy: { id: 'desc' }, skip, take: params.limit }),
      this.prisma.client.count({ where }),
    ]);
    return { items, total, page: params.page, limit: params.limit };
  }

  create(data: any) {
    return this.prisma.client.create({ data });
  }

  update(id: number, data: any) {
    return this.prisma.client.update({ where: { id }, data });
  }

  async remove(id: number) {
    // Если есть заказы — запрещаем удаление (предложить архивировать)
    const ordCount = await this.prisma.order.count({ where: { clientId: id } });
    if (ordCount > 0) {
      throw new BadRequestException('Невозможно удалить клиента: у него есть связанные заказы. Перенесите клиента в архив.');
    }

    // Удаляем зависимые сущности и затем клиента
    return this.prisma.$transaction(async (tx) => {
      await tx.subscription.deleteMany({ where: { clientId: id } });
      await tx.task.deleteMany({ where: { clientId: id } });
      // комментариев к заказам тут нет, т.к. заказов нет (ordCount=0)
      return tx.client.delete({ where: { id } });
    });
  }
}