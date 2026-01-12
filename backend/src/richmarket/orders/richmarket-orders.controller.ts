import { Controller, Get, Post, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { RichMarketOrdersService } from './richmarket-orders.service';

@Controller('richmarket/orders')
export class RichMarketOrdersController {
  constructor(private readonly service: RichMarketOrdersService) {}

  @Get()
  list(@Query() query: any) {
    return this.service.list(query);
  }

  @Post()
  create(@Body() body: any, @Req() req: any) {
    const userId = req?.user?.id || 1;
    return this.service.create(body, userId);
  }

  @Post(':id/assign')
  async assign(@Param('id') id: string, @Req() req: any) {
    const userId = req?.user?.id || 1;
    return this.service.assign(Number(id), userId);
  }

  @Post(':id/complete')
  async complete(@Param('id') id: string) {
    return this.service.complete(Number(id));
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(Number(id));
  }

  // ✅ ДОБАВЬТЕ ЭТОТ ЭНДПОИНТ ДЛЯ АРХИВА
  @Get('sold-products')
  async getSoldProducts() {
    return this.service.getTopProducts();
  }

  @Get('analytics/dashboard')
  async getDashboardAnalytics(@Query('period') period: string = 'week') {
    return this.service.getDashboardAnalytics(period);
  }

  @Get('analytics/sales-trend')
  async getSalesTrend(@Query('period') period: string = 'week') {
    return this.service.getSalesTrend(period);
  }

  @Get('analytics/orders-by-status')
  async getOrdersByStatus() {
    return this.service.getOrdersByStatus();
  }

  @Get('analytics/delivery-methods')
  async getDeliveryMethods() {
    return this.service.getDeliveryMethods();
  }

  @Get('analytics/top-products')
  async getTopProducts(@Query('limit') limit: string = '3') {
    return this.service.getTopProducts(Number(limit));
  }

  @Get('analytics/recent-activity')
  async getRecentActivity(@Query('limit') limit: string = '4') {
    return this.service.getRecentActivity(Number(limit));
  }

}