import { Module } from '@nestjs/common';
import { RichMarketProductsController } from './richmarket-products.controller';
import { RichMarketProductsService } from './richmarket-products.service';
import { PrismaService } from '../../prisma.service';


@Module({
  controllers: [RichMarketProductsController],
  providers: [RichMarketProductsService, PrismaService],
  exports: [RichMarketProductsService],
})
export class RichMarketProductsModule {}