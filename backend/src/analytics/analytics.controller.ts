import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { AnalyticsMlService } from './analytics-ml.service';
import { MarketplaceInsightsService } from './marketplace-insights.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class AnalyticsController {
  constructor(
    private service: AnalyticsService,
    private ml: AnalyticsMlService,
    private marketplaceInsights: MarketplaceInsightsService,
  ) {}

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

  @Get('dashboard/support')
  dashboardSupport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.dashboardSupport(from, to, limit ? Number(limit) : undefined);
  }

  @Get('dashboard/summary')
  dashboardSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.dashboardSummary(from, to, limit ? Number(limit) : undefined);
  }

  @Get('marketplace/overview')
  marketplaceOverview(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('accountId') accountId?: string,
    @Query('days') days?: string,
  ) {
    return this.marketplaceInsights.overview(
      from,
      to,
      accountId ? Number(accountId) : undefined,
      days,
    );
  }

  @Get('marketplace/listings')
  marketplaceListings(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('accountId') accountId?: string,
    @Query('days') days?: string,
  ) {
    return this.marketplaceInsights.listings(
      from,
      to,
      accountId ? Number(accountId) : undefined,
      days,
    );
  }

  @Get('ml/marketplace')
  marketplaceLearning(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('accountId') accountId?: string,
    @Query('days') days?: string,
  ) {
    return this.marketplaceInsights.learningSummary(
      from,
      to,
      accountId ? Number(accountId) : undefined,
      days,
    );
  }

  @Get('ml/marketplace/reply-suggestions')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  marketplaceReplySuggestions(
    @Query('question') question?: string,
    @Query('itemTitle') itemTitle?: string,
    @Query('accountId') accountId?: string,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketplaceInsights.replySuggestions({
      question,
      itemTitle,
      accountId: accountId ? Number(accountId) : undefined,
      days,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('marketplace/sync')
  syncMarketplace() {
    return this.marketplaceInsights.syncConnectedAvitoAccounts();
  }

  @Get('ml/sku')
  mlSku(@Query('days') days?: string) {
    return this.ml.getSkuForecast(days ? Number(days) : 7);
  }

  @Get('ml/employees')
  mlEmployees() {
    return this.ml.getEmployeeForecast();
  }

  @Get('ml/ad-budget')
  mlAdBudget(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('totalWeeklyBudget') totalWeeklyBudget?: string,
  ) {
    return this.ml.getAdBudgetForecast(
      from,
      to,
      totalWeeklyBudget ? Number(totalWeeklyBudget) : undefined,
    );
  }

  @Get('ml/status')
  mlStatus() {
    return this.ml.status();
  }

  @Post('ml/recompute')
  mlRecompute() {
    return this.ml.recompute();
  }
}
