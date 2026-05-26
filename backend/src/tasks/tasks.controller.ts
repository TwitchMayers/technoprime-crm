import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  Inject,
  forwardRef,
  ForbiddenException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { OrdersService } from '../orders/orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TaskStatus } from '@prisma/client';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
  ) {}

  @Get()
  async list(@Query() query: any, @Req() req: any) {
    return this.tasksService.list({
      assignedToId: query?.assignedToId,
      status: query?.status,
      clientId: query?.clientId,
      limit: query?.limit,
      offset: query?.offset,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.tasksService.findOne(Number(id));
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const assignedToId = Number(body.assignedToId || req?.user?.id);

    return this.tasksService.create({
      title: body.title,
      type: body.type,
      assignedToId,
      clientId: body.clientId ? Number(body.clientId) : undefined,
      orderId: body.orderId ? Number(body.orderId) : undefined,
      dueDate: new Date(body.dueDate || Date.now()),
      comment: body.comment,
    });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const taskId = Number(id);
    if (!Number.isFinite(taskId) || taskId <= 0) {
      throw new BadRequestException('Некорректный ID задачи');
    }

    const status = body?.status;
    const comment = body?.comment;
    const userId = Number(req?.user?.id || 0);
    const userRole = String(req?.user?.role || '');

    const existingTask = await this.tasksService.findOne(taskId);
    if (!existingTask) {
      throw new BadRequestException('Задача не найдена');
    }

    const shouldAcceptTask =
      status === TaskStatus.IN_PROGRESS &&
      (body?.accept === true || String(existingTask.status) === TaskStatus.NEW);

    if (shouldAcceptTask) {
      const canAccept =
        userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'TECHNICAL_SPECIALIST';
      if (!canAccept) {
        throw new ForbiddenException('Принять задачу может только админ или техник');
      }
      if (!userId) {
        throw new BadRequestException('Не удалось определить пользователя для принятия задачи');
      }
    }

    // ✅ Обновляем задачу
    const task = await this.tasksService.update(
      taskId,
      {
        status,
        comment,
      },
      shouldAcceptTask ? { acceptedByUserId: userId } : undefined,
    );

    // ✅ КЛЮЧЕВОЕ ДОБАВЛЕНИЕ: синхронизируем статус заказа если это задача с заказом
    if (task?.orderId && status === 'DONE') {
      try {
        // Вызываем метод синхронизации из OrdersService
        await this.ordersService.syncOrderStatusFromTasks(
          task.orderId,
          Number(req?.user?.id || 0) || undefined,
        );
      } catch (err) {
        console.error(`❌ Failed to sync order #${task.orderId} status:`, err.message);
      }
    }

    return task;
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.tasksService.delete(Number(id));
  }
}
