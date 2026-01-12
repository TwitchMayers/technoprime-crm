import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [AnalyticsService, PrismaService],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}