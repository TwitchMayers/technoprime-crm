import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  BadRequestException,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProductsService } from './products.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const PRODUCT_IMAGE_MAX_SIZE = 8 * 1024 * 1024;

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Получить список товаров' })
  @ApiResponse({ status: 200, description: 'Список товаров' })
  async list(@Query() query: any, @Req() req: Request & { user?: any }) {
    return this.productsService.list(query, req.user?.role);
  }

  @Get('storefront-categories')
  @ApiOperation({ summary: 'Категории каталога витрины' })
  @ApiResponse({ status: 200, description: 'Категории витрины' })
  async storefrontCategories() {
    return this.productsService.listStorefrontCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить товар по ID' })
  @ApiResponse({ status: 200, description: 'Товар найден' })
  @ApiResponse({ status: 404, description: 'Товар не найден' })
  async findOne(@Param('id') id: string, @Req() req: Request & { user?: any }) {
    return this.productsService.findOne(Number(id), req.user?.role);
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

  @Post(':id/images')
  @ApiOperation({ summary: 'Загрузить изображения товара' })
  @UseInterceptors(
    FilesInterceptor('files', 30, {
      limits: {
        fileSize: PRODUCT_IMAGE_MAX_SIZE,
      },
      storage: diskStorage({
        destination: (req, file, cb) => {
          const id = Number(req.params?.id);
          const folder = join(process.cwd(), '..', 'assets', 'shop', 'products', String(id));
          mkdirSync(folder, { recursive: true });
          cb(null, folder);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          const suffix = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
          cb(null, `${suffix}${ext || '.jpg'}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname || '').toLowerCase();
        const mime = String(file.mimetype || '').toLowerCase();
        if (mime.startsWith('image/') && IMAGE_EXTENSIONS.has(ext)) cb(null, true);
        else cb(new Error('Only jpg/jpeg/png/webp/gif/avif files are allowed'), false);
      },
    }),
  )
  async uploadImages(@Param('id') id: string, @UploadedFiles() files: Array<{ filename: string }>) {
    const filenames = (files || []).map(file => file.filename);
    return this.productsService.addImages(Number(id), filenames);
  }

  @Patch(':id/images/cover')
  @ApiOperation({ summary: 'Сделать изображение главным' })
  async setCover(@Param('id') id: string, @Body() body: { url: string }) {
    return this.productsService.setCoverImage(Number(id), body?.url);
  }

  @Post(':id/preview-image')
  @ApiOperation({ summary: 'Загрузить отдельное превью для карточки каталога' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: PRODUCT_IMAGE_MAX_SIZE,
      },
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const id = Number(req.params?.id);
          const folder = join(process.cwd(), '..', 'assets', 'shop', 'products', String(id));
          mkdirSync(folder, { recursive: true });
          cb(null, folder);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          const suffix = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
          cb(null, `preview_${suffix}${ext || '.jpg'}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname || '').toLowerCase();
        const mime = String(file.mimetype || '').toLowerCase();
        if (mime.startsWith('image/') && IMAGE_EXTENSIONS.has(ext)) cb(null, true);
        else cb(new Error('Only jpg/jpeg/png/webp/gif/avif files are allowed'), false);
      },
    }),
  )
  async uploadPreviewImage(@Param('id') id: string, @UploadedFile() file?: { filename?: string }) {
    if (!file?.filename) {
      throw new BadRequestException('Файл превью не загружен');
    }
    return this.productsService.uploadPreviewImage(Number(id), file.filename);
  }

  @Patch(':id/preview-image')
  @ApiOperation({ summary: 'Установить превью из существующего фото товара' })
  async setPreviewImage(@Param('id') id: string, @Body() body: { url: string }) {
    return this.productsService.setPreviewImage(Number(id), body?.url);
  }

  @Delete(':id/preview-image')
  @ApiOperation({ summary: 'Удалить превью карточки каталога' })
  async removePreviewImage(@Param('id') id: string) {
    return this.productsService.removePreviewImage(Number(id));
  }

  @Patch(':id/images/reorder')
  @ApiOperation({ summary: 'Изменить порядок изображений' })
  async reorderImages(@Param('id') id: string, @Body() body: { images: string[] }) {
    return this.productsService.reorderImages(
      Number(id),
      Array.isArray(body?.images) ? body.images : [],
    );
  }

  @Delete(':id/images')
  @ApiOperation({ summary: 'Удалить изображение товара' })
  async removeImage(@Param('id') id: string, @Body() body: { url: string }) {
    return this.productsService.removeImage(Number(id), body?.url);
  }

  @Post(':id/stock/attach')
  @ApiOperation({ summary: 'Добавить наличие к карточке из складской позиции' })
  async attachStock(
    @Param('id') id: string,
    @Body() body: { sourceProductId: number; qty: number; targetVariantKey?: string | null },
  ) {
    return this.productsService.attachStockFromWarehouse(
      Number(id),
      Number(body?.sourceProductId),
      Number(body?.qty || 0),
      body?.targetVariantKey ?? null,
    );
  }

  @Patch(':id/stock/adjust')
  @ApiOperation({ summary: 'Изменить остаток складской позиции (дельта)' })
  async adjustStock(@Param('id') id: string, @Body() body: { delta: number }) {
    return this.productsService.adjustWarehouseStockByDelta(Number(id), Number(body?.delta || 0));
  }
}
