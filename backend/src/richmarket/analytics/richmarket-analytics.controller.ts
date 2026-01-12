import { Controller, Get, Query } from '@nestjs/common';
import { RichMarketAnalyticsService } from './richmarket-analytics.service';

@Controller('richmarket/analytics')
export class RichMarketAnalyticsController {
  constructor(private readonly analyticsService: RichMarketAnalyticsService) {}

  @Get('dashboard')
  async getDashboardData(@Query('period') period: string = 'week') {
    return this.analyticsService.getDashboardData(period);
  }

  @Get('sales-trend')
  async getSalesTrend(@Query('period') period: string = 'week') {
    return this.analyticsService.getSalesTrend(period);
  }

  @Get('orders-by-status')
  async getOrdersByStatus() {
    return this.analyticsService.getOrdersByStatus();
  }

  @Get('delivery-methods')
  async getDeliveryMethods() {
    return this.analyticsService.getDeliveryMethods();
  }

  @Get('top-products')
  async getTopProducts(@Query('limit') limit: string = '5') {
    return this.analyticsService.getTopProducts(Number(limit));
  }

  @Get('recent-activity')
  async getRecentActivity(@Query('limit') limit: string = '4') {
    return this.analyticsService.getRecentActivity(Number(limit));
  }
}