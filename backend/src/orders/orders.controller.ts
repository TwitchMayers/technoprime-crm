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
  UnauthorizedException,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Список заказов с фильтрацией
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

  // Queue route must stay before /:id.
  @Get('queue')
  async queue() {
    return this.ordersService.queue();
  }

  // Single-order route follows /queue.
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(Number(id));
  }

  // Создать заказ
  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const userId = Number(req?.user?.id);
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

    if (!clientId) throw new BadRequestException('clientId is required');
    if (!items.length) throw new BadRequestException('At least one item is required');
    if (!userId) throw new UnauthorizedException('Unauthorized');

    return this.ordersService.create(
      {
        clientId,
        paymentMethod: paymentMethod as any,
        comment,
        items,
        salesChannel: body?.salesChannel,
        fulfillmentMethod: body?.fulfillmentMethod,
        settlementStatus: body?.settlementStatus,
        expectedPayout: body?.expectedPayout,
        actualPayout: body?.actualPayout,
        marketplaceCommission: body?.marketplaceCommission,
        shipment: body?.shipment,
      },
      userId,
    );
  }

  // Назначить заказ - PATCH /api/orders/:id/assign
  @Patch(':id/assign')
  async assignPatch(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const assigneeId = Number(body?.assigneeId ?? req?.user?.id ?? 0);
    return this.ordersService.assign(Number(id), assigneeId);
  }

  // Назначить заказ - POST /api/orders/:id/assign
  @Post(':id/assign')
  async assignPost(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const assigneeId = Number(body?.assigneeId ?? req?.user?.id ?? 0);
    return this.ordersService.assign(Number(id), assigneeId);
  }

  @Post(':id/send-to-tasks')
  async sendToTasks(@Param('id') id: string, @Req() req: any) {
    const actorId = Number(req?.user?.id ?? 0);
    return this.ordersService.sendLeadToTasks(Number(id), actorId);
  }

  @Get(':id/lead-inventory-options')
  async leadInventoryOptions(@Param('id') id: string) {
    return this.ordersService.getLeadInventoryOptions(Number(id));
  }

  @Patch(':id/lead')
  async updateLead(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const actorId = Number(req?.user?.id ?? 0);
    return this.ordersService.updateLead(
      Number(id),
      {
        name: body?.name,
        phone: body?.phone,
        city: body?.city,
        address: body?.address,
        comment: body?.comment,
        inventoryUnitId: body?.inventoryUnitId,
      },
      actorId,
    );
  }

  @Post(':id/extend-reserve')
  async extendReserve(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const actorId = Number(req?.user?.id ?? 0);
    const minutes = Number(body?.minutes ?? 15);
    return this.ordersService.extendReserve(Number(id), minutes, actorId);
  }

  // Изменить статус заказа - PATCH /api/orders/:id/status
  @Patch(':id/status')
  async setStatusPatch(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const status = String(body?.status || 'NEW');
    const archiveOnComplete =
      body?.archiveOnComplete === undefined ? undefined : Boolean(body?.archiveOnComplete);
    const managerId = Number(body?.managerId ?? req?.user?.id ?? 0);

    return this.ordersService.setStatus(Number(id), status as any, archiveOnComplete, managerId);
  }

  // Изменить статус заказа - POST /api/orders/:id/status
  @Post(':id/status')
  async setStatusPost(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const status = String(body?.status || 'NEW');
    const archiveOnComplete =
      body?.archiveOnComplete === undefined ? undefined : Boolean(body?.archiveOnComplete);
    const managerId = Number(body?.managerId ?? req?.user?.id ?? 0);

    return this.ordersService.setStatus(Number(id), status as any, archiveOnComplete, managerId);
  }

  // Получить комментарии заказа
  @Get(':id/comments')
  async getComments(@Param('id') id: string) {
    return this.ordersService.comments(Number(id));
  }

  // Добавить комментарий к заказу
  @Post(':id/comments')
  async addComment(
    @Param('id') id: string,
    @Body() body: { authorId?: number; text: string },
    @Req() req: any,
  ) {
    const authorId = body.authorId ?? req?.user?.id;

    if (!body.text?.trim()) {
      throw new BadRequestException('Comment text is required');
    }

    return this.ordersService.addComment(Number(id), authorId, body.text);
  }

  // Удалить заказ
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    const adminId = Number(req?.user?.id);
    if (!adminId) {
      throw new UnauthorizedException('Unauthorized');
    }
    return this.ordersService.delete(Number(id), adminId);
  }
}
