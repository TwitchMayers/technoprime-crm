import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ShopProductsService } from './shop-products.service';
import { ShopApiGuard } from './shop-api.guard';

@ApiTags('shop')
@Controller('shop/products')
@UseGuards(ShopApiGuard)
export class ShopProductsController {
  constructor(private readonly shopProducts: ShopProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Публичный список товаров для витрины' })
  @ApiResponse({ status: 200, description: 'Список товаров' })
  async list(@Query() query: any) {
    return this.shopProducts.listPublic(query);
  }

  @Get('store-categories')
  @ApiOperation({ summary: 'Категории каталога для сайта' })
  @ApiResponse({ status: 200, description: 'Список категорий каталога' })
  async storeCategories() {
    return this.shopProducts.listStoreCategories();
  }

  @Get('top-viewed')
  @ApiOperation({ summary: 'Топ самых просматриваемых товаров' })
  @ApiResponse({ status: 200, description: 'Топ товаров по просмотрам' })
  async topViewed(@Query() query: any) {
    return this.shopProducts.listTopViewed({
      limit: query?.limit ? Number(query.limit) : undefined,
      days: query?.days ? Number(query.days) : undefined,
    });
  }

  @Post('views')
  @ApiOperation({ summary: 'Записать просмотр карточки товара' })
  @ApiResponse({ status: 200, description: 'Просмотр записан' })
  async trackView(@Body() body: { productId?: number; cookieId?: string | null }) {
    return this.shopProducts.trackView(body || {});
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Публичная карточка товара по slug' })
  @ApiResponse({ status: 200, description: 'Товар найден' })
  async findOneBySlug(@Param('slug') slug: string) {
    return this.shopProducts.findBySlugPublic(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Публичная карточка товара' })
  @ApiResponse({ status: 200, description: 'Товар найден' })
  async findOne(@Param('id') id: string) {
    return this.shopProducts.findOnePublic(Number(id));
  }
}
