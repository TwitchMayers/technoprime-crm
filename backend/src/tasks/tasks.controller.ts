import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { OrdersService } from '../orders/orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
    const userRole = req?.user?.role;
    const userId = req?.user?.id;

    console.log('📋 Tasks GET - User:', userId, 'Role:', userRole);

    // ✅ ADMIN видит ВСЕ задачи
    if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
      const tasks = await this.tasksService.list({});
      console.log(`📋 ADMIN: returning ${tasks.length} all tasks`);
      return tasks;
    }

    // ✅ TECHNICAL_SPECIALIST видит всё
    if (userRole === 'TECHNICAL_SPECIALIST') {
      const tasks = await this.tasksService.list({});
      console.log(`📋 TECH_SPECIALIST: returning ${tasks.length} all tasks`);
      return tasks;
    }

    // ✅ MANAGER видит всё
    if (userRole === 'MANAGER') {
      const tasks = await this.tasksService.list({});
      console.log(`📋 MANAGER: returning ${tasks.length} all tasks`);
      return tasks;
    }

    // По умолчанию
    return await this.tasksService.list({});
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
    const status = body?.status;
    const comment = body?.comment;

    console.log(`📝 Updating task ${taskId}:`, { status, comment });

    // ✅ Обновляем задачу
    const task = await this.tasksService.update(taskId, {
      status,
      comment,
    });

    // ✅ КЛЮЧЕВОЕ ДОБАВЛЕНИЕ: синхронизируем статус заказа если это задача с заказом
    if (task?.orderId && status === 'DONE') {
      console.log(`🔄 Task #${taskId} is DONE → syncing order #${task.orderId} status`);
      try {
        // Вызываем метод синхронизации из OrdersService
        await this.ordersService.syncOrderStatusFromTasks(task.orderId);
        console.log(`✅ Order #${task.orderId} synced successfully`);
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