import { Module } from '@nestjs/common';
import { LogisticsController } from './logistics.controller';
import { LogisticsOAuthController } from './logistics-oauth.controller';
import { LogisticsService } from './logistics.service';
import { PrismaService } from '../prisma.service';
import { InventoryModule } from '../inventory/inventory.module';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [InventoryModule, EventsModule, NotificationsModule],
  controllers: [LogisticsController, LogisticsOAuthController],
  providers: [LogisticsService, PrismaService],
  exports: [LogisticsService],
})
export class LogisticsModule {}
