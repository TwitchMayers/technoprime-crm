import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.task.findMany({
      include: { client: true, assignedTo: true },
      orderBy: { id: 'desc' },
    });
  }

  create(data: any) {
    return this.prisma.task.create({ data });
  }

  update(id: number, data: { status?: 'NEW'|'IN_PROGRESS'|'DONE'; assignedToId?: number }) {
    return this.prisma.task.update({
      where: { id },
      data: {
        status: data.status ?? undefined,
        assignedToId: data.assignedToId ?? undefined,
      },
    });
  }
}