import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ShopFeaturedService } from './shop-featured.service';
import { ShopApiGuard } from './shop-api.guard';

@ApiTags('shop-featured')
@Controller('shop/featured')
@UseGuards(ShopApiGuard)
export class ShopFeaturedController {
  constructor(private readonly featured: ShopFeaturedService) {}

  @Get()
  @ApiOperation({ summary: 'Публичные карточки для витрины' })
  @ApiResponse({ status: 200 })
  async list() {
    return this.featured.listPublic();
  }
}
