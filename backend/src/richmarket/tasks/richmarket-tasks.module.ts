import { Module } from '@nestjs/common';
import { RichMarketTasksController } from './richmarket-tasks.controller';
import { RichMarketTasksService } from './richmarket-tasks.service';
import { RichMarketOrdersService } from '../orders/richmarket-orders.service'; // Добавляем
import { PrismaService } from '../../prisma.service';
import { EventsModule } from '../../events/events.module'; // Если нужно

@Module({
  imports: [EventsModule], // Если используется EventsService
  controllers: [RichMarketTasksController],
  providers: [RichMarketTasksService, RichMarketOrdersService, PrismaService],
})
export class RichMarketTasksModule {}