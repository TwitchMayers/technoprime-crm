import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Delete, 
  Body, 
  Param, 
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Получить список товаров' })
  @ApiResponse({ status: 200, description: 'Список товаров' })
  async list(@Query() query: any) {
    return this.productsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить товар по ID' })
  @ApiResponse({ status: 200, description: 'Товар найден' })
  @ApiResponse({ status: 404, description: 'Товар не найден' })
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(Number(id));
  }

  @Post()
  @ApiOperation({ summary: 'Создать новый товар' })
  @ApiResponse({ status: 201, description: 'Товар создан' })
  async create(@Body() body: any) {
    return this.productsService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить товар' })
  @ApiResponse({ status: 200, description: 'Товар обновлен' })
  async update(@Param('id') id: string, @Body() body: any) {
    return this.productsService.update(Number(id), body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить товар' })
  @ApiResponse({ status: 200, description: 'Товар удален' })
  async remove(@Param('id') id: string) {
    return this.productsService.remove(Number(id));
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Архивировать товар' })
  @ApiResponse({ status: 200, description: 'Товар архивирован' })
  async archive(@Param('id') id: string) {
    return this.productsService.archive(Number(id));
  }

  @Patch(':id/unarchive')
  @ApiOperation({ summary: 'Восстановить товар из архива' })
  @ApiResponse({ status: 200, description: 'Товар восстановлен' })
  async unarchive(@Param('id') id: string) {
    return this.productsService.unarchive(Number(id));
  }
}