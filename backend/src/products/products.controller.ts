import { Body, Controller, Get, Patch, Post, Query, Param, Delete } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private svc: ProductsService) {}

  @Get()
  list(
    @Query('isArchived') isArchived?: string,
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const flag = typeof isArchived === 'string' ? isArchived === 'true' : undefined;
    return this.svc.list({ isArchived: flag, q, category, page: Number(page) || 1, limit: Number(limit) || 50 });
  }

  @Post()
  create(@Body() body: any) { return this.svc.create(body); }

  @Patch(':id/archive')
  archive(@Param('id') id: string) { return this.svc.archive(Number(id), true); }

  @Patch(':id/unarchive')
  unarchive(@Param('id') id: string) { return this.svc.archive(Number(id), false); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(Number(id)); }
}