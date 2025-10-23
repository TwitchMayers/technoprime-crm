import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private svc: OrdersService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('q') q?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.svc.list({ status, assigneeId, q, dateFrom, dateTo });
  }

  @Get('queue')
  queue() {
    return this.svc.queue();
  }

  @Post()
  create(@Body() body: CreateOrderDto) {
    return this.svc.create(body);
  }

  @Patch(':id/assign')
  assign(@Param('id') id: string, @Body('assigneeId') assigneeId: number) {
    return this.svc.assign(Number(id), Number(assigneeId));
  }

  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body('status') status: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED',
    @Body('archiveOnComplete') archiveOnComplete?: boolean,
  ) {
    return this.svc.setStatus(Number(id), status, archiveOnComplete);
  }

  @Get(':id/comments')
  comments(@Param('id') id: string) {
    return this.svc.comments(Number(id));
  }

  @Post(':id/comments')
  addComment(@Param('id') id: string, @Body() body: { authorId: number; text: string }) {
    return this.svc.addComment(Number(id), body.authorId, body.text);
  }
}