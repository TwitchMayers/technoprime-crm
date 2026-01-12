import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private service: AnalyticsService) {}

  @Get('overview')
  overview(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.overview(from, to);
  }

  @Get('employees')
  employees(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.employees(from, to);
  }

  @Get('sales-by-ads')
  salesByAds(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.salesByAds(from, to);
  }

  @Get('seasonality')
seasonality(@Query('year') year?: string) {
  return this.service.seasonality(year ? Number(year) : undefined);
}
}