import { Module } from '@nestjs/common';
import { AdSpendService } from './ad-spend.service';
import { AdSpendController } from './ad-spend.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [AdSpendService, PrismaService],
  controllers: [AdSpendController],
  exports: [AdSpendService],
})
export class AdSpendModule {}
