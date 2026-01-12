import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [InventoryService, PrismaService],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}