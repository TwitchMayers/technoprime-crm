import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { AdSpendService } from './ad-spend.service';
import { AdSku } from '@prisma/client';

@Controller('ad-spend')
export class AdSpendController {
  constructor(private service: AdSpendService) {}

  @Post('upsert')
  upsert(@Body() body: { date?: string; adSku: AdSku; amount: number; note?: string; createdById?: number }) {
    return this.service.upsert(body);
  }

  @Get()
  list(@Query('from') from?: string, @Query('to') to?: string, @Query('adSku') adSku?: AdSku) {
    return this.service.list({ from, to, adSku });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }
}