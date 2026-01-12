import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Query,
  Req,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ✅ Список заказов с фильтрацией
  @Get()
  async list(
    @Query('status') status?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('q') q?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    console.log('📋 Orders GET:', {
      status,
      assigneeId,
      q,
      dateFrom,
      dateTo,
      page,
      limit,
    });

    return this.ordersService.list({
      status,
      assigneeId,
      q,
      dateFrom,
      dateTo,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // ✅ Очередь новых заказов (ДОЛЖНА БЫТЬ ПЕРЕД /:id)
  @Get('queue')
  async queue() {
    console.log('📋 Orders QUEUE');
    return this.ordersService.queue();
  }

  // ✅ Получить один заказ (ПОСЛЕ /queue)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    console.log('📋 Order GET:', id);
    return this.ordersService.findOne(Number(id));
  }

  // ✅ Создать заказ
  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const userId = Number(req?.user?.id ?? 1);
    const clientId = Number(body?.clientId);
    const paymentMethod = String(body?.paymentMethod || 'CASH').toUpperCase();
    const comment = body?.comment ? String(body.comment) : '';
    const itemsRaw = Array.isArray(body?.items) ? body.items : [];
    const items = itemsRaw
      .map((i: any) => ({
        productId: Number(i?.productId),
        qty: Math.max(1, Number(i?.qty ?? 1)),
        salePrice: Number(i?.salePrice ?? 0),
      }))
      .filter((i: any) => i.productId > 0);

    console.log('📝 Creating order:', {
      clientId,
      paymentMethod,
      itemsCount: items.length,
      userId,
    });

    if (!clientId) throw new BadRequestException('clientId is required');
    if (!items.length) throw new BadRequestException('At least one item is required');

    return this.ordersService.create(
      { clientId, paymentMethod: paymentMethod as any, comment, items },
      userId,
    );
  }

  // ✅ Назначить заказ - PATCH /api/orders/:id/assign
  @Patch(':id/assign')
  async assignPatch(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const assigneeId = Number(body?.assigneeId ?? req?.user?.id ?? 0);
    console.log(`📌 Assigning order ${id} to ${assigneeId}`);
    return this.ordersService.assign(Number(id), assigneeId);
  }

  // ✅ Назначить заказ - POST /api/orders/:id/assign
  @Post(':id/assign')
  async assignPost(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const assigneeId = Number(body?.assigneeId ?? req?.user?.id ?? 0);
    console.log(`📌 Assigning order ${id} to ${assigneeId}`);
    return this.ordersService.assign(Number(id), assigneeId);
  }

  // ✅ Изменить статус заказа - PATCH /api/orders/:id/status
  @Patch(':id/status')
  async setStatusPatch(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const status = String(body?.status || 'NEW');
    const archiveOnComplete = !!body?.archiveOnComplete;
    const managerId = Number(body?.managerId ?? req?.user?.id ?? 0);

    console.log(
      `📊 Patching order ${id} status to ${status}, archive=${archiveOnComplete}, manager=${managerId}`,
    );
    return this.ordersService.setStatus(
      Number(id),
      status as any,
      archiveOnComplete,
      managerId,
    );
  }

  // ✅ Изменить статус заказа - POST /api/orders/:id/status
  @Post(':id/status')
  async setStatusPost(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const status = String(body?.status || 'NEW');
    const archiveOnComplete = !!body?.archiveOnComplete;
    const managerId = Number(body?.managerId ?? req?.user?.id ?? 0);

    console.log(
      `📊 Posting order ${id} status to ${status}, archive=${archiveOnComplete}, manager=${managerId}`,
    );
    return this.ordersService.setStatus(
      Number(id),
      status as any,
      archiveOnComplete,
      managerId,
    );
  }

  // ✅ Получить комментарии заказа
  @Get(':id/comments')
  async getComments(@Param('id') id: string) {
    console.log('💬 Getting comments for order:', id);
    return this.ordersService.comments(Number(id));
  }

  // ✅ Добавить комментарий к заказу
  @Post(':id/comments')
  async addComment(
    @Param('id') id: string,
    @Body() body: { authorId?: number; text: string },
    @Req() req: any,
  ) {
    const authorId = body.authorId ?? req?.user?.id;
    console.log('💬 Adding comment to order:', id, 'by user:', authorId);

    if (!body.text?.trim()) {
      throw new BadRequestException('Comment text is required');
    }

    return this.ordersService.addComment(Number(id), authorId, body.text);
  }

  // ✅ Удалить заказ
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    const adminId = Number(req?.user?.id ?? 1);
    console.log('🗑️ Deleting order:', id, 'by admin:', adminId);
    return this.ordersService.delete(Number(id), adminId);
  }
}