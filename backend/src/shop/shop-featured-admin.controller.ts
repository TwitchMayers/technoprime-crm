import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ShopFeaturedService } from './shop-featured.service';

@ApiTags('shop-featured-admin')
@ApiBearerAuth()
@Controller('shop/admin/featured')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
export class ShopFeaturedAdminController {
  constructor(private readonly featured: ShopFeaturedService) {}

  @Get()
  @ApiOperation({ summary: 'Список карточек для CRM' })
  @ApiResponse({ status: 200 })
  async list() {
    return this.featured.listAdmin();
  }

  @Post()
  @ApiOperation({ summary: 'Создать карточку' })
  async create(@Body() body: any) {
    return this.featured.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить карточку' })
  async update(@Param('id') id: string, @Body() body: any) {
    return this.featured.update(Number(id), body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить карточку' })
  async remove(@Param('id') id: string) {
    return this.featured.remove(Number(id));
  }
}
