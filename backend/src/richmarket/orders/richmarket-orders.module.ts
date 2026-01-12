import { Module } from '@nestjs/common';
import { RichMarketOrdersController } from './richmarket-orders.controller';
import { RichMarketOrdersService } from './richmarket-orders.service';
import { PrismaService } from '../../prisma.service';
import { EventsModule } from '../../events/events.module';


@Module({
  imports: [EventsModule],
  controllers: [RichMarketOrdersController],
  providers: [RichMarketOrdersService, PrismaService],
})
export class RichMarketOrdersModule {}