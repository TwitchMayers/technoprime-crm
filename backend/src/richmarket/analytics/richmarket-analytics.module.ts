import { Module } from '@nestjs/common';
import { RichMarketAnalyticsController } from './richmarket-analytics.controller';
import { RichMarketAnalyticsService } from './richmarket-analytics.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [RichMarketAnalyticsController],
  providers: [RichMarketAnalyticsService, PrismaService],
  exports: [RichMarketAnalyticsService],
})
export class RichMarketAnalyticsModule {}