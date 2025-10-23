import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  list(userId: number, unread?: boolean) {
    return this.prisma.notification.findMany({
      where: { userId, readAt: unread ? null : undefined },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: number) {
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('Invalid notification id');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async push(userId: number, type: string, payload?: any) {
    return this.prisma.notification.create({ data: { userId, type, payload } });
  }
}