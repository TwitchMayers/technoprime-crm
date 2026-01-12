import { Controller, Get, Post, Put, Delete, Body, Param, Query, Patch } from '@nestjs/common';
import { RichMarketProductsService } from './richmarket-products.service';


@Controller('richmarket/products')
export class RichMarketProductsController {
  constructor(private readonly productsService: RichMarketProductsService) {}

  @Get()
  async list(@Query() query: any) {
    return this.productsService.list(query);
  }

  @Post()
  async create(@Body() data: any) {
    return this.productsService.create(data);
  }

  @Put(':id') // Добавляем PUT метод
  async update(@Param('id') id: string, @Body() data: any) {
    return this.productsService.update(Number(id), data);
  }

  @Patch(':id') // Оставляем PATCH для совместимости
  async patch(@Param('id') id: string, @Body() data: any) {
    return this.productsService.update(Number(id), data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.productsService.delete(Number(id));
  }

  @Patch(':id/archive')
  async archive(@Param('id') id: string) {
    return this.productsService.archive(Number(id));
  }

  @Patch(':id/unarchive')
  async unarchive(@Param('id') id: string) {
    return this.productsService.unarchive(Number(id));
  }

  @Get('brands')
  async getBrands() {
    return this.productsService.getBrands();
  }

  @Get('for-order')
  async getForOrder() {
    return this.productsService.getForOrder();
  }
}