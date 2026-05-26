import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { PrismaService } from '../prisma.service';
import { AnalyticsMlService } from './analytics-ml.service';
import { MarketplaceInsightsService } from './marketplace-insights.service';
import { LogisticsModule } from '../logistics/logistics.module';

@Module({
  imports: [LogisticsModule],
  providers: [AnalyticsService, AnalyticsMlService, MarketplaceInsightsService, PrismaService],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
