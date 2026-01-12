import { Module } from '@nestjs/common';
import { RichMarketClientsController } from './richmarket-clients.controller';
import { RichMarketClientsService } from './richmarket-clients.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [RichMarketClientsController],
  providers: [RichMarketClientsService, PrismaService],
  exports: [RichMarketClientsService],
})
export class RichMarketClientsModule {}