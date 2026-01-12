import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async list(query?: any) {
    try {
      const where: Prisma.ProductWhereInput = {
        tenant: 'TECHNOPRIME',
      };
      
      // ✅ ИСПРАВЛЕНО: только валидные категории
      const validCategories = ['CONSOLE', 'ACCESSORY', 'DISK', 'SERVICE', 'SUBSCRIPTION_KEY'];
      
      if (query?.category && query.category !== 'all' && validCategories.includes(query.category)) {
        where.category = query.category;
      }
      
      if (query?.isArchived !== undefined) {
        where.isActive = query.isArchived === 'false';
      }
      
      if (query?.q) {
        where.OR = [
          { name: { contains: query.q, mode: 'insensitive' } },
          { brand: { contains: query.q, mode: 'insensitive' } },
          { model: { contains: query.q, mode: 'insensitive' } },
          { serialNumber: { contains: query.q, mode: 'insensitive' } },
        ];
      }

      const limit = query?.limit ? Number(query.limit) : 500;

      const items = await this.prisma.product.findMany({
        where,
        take: limit,
        orderBy: { id: 'desc' },
      });

      return {
        items,
        total: items.length,
        success: true,
      };
    } catch (error) {
      console.error('Error listing products:', error);
      throw error;
    }
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Товар #${id} не найден`);
    }

    return product;
  }

  async create(data: any) {
    try {
      const validCategories = ['CONSOLE', 'ACCESSORY', 'DISK', 'SERVICE', 'SUBSCRIPTION_KEY'];
      const category = validCategories.includes(data.category) ? data.category : 'CONSOLE';

      return await this.prisma.product.create({
        data: {
          tenant: 'TECHNOPRIME',
          name: data.name,
          category: category,
          brand: data.brand,
          model: data.model,
          version: data.version,
          stock: Number(data.stock || 0),
          costPrice: Number(data.costPrice || 0),
          price: Number(data.price || 0),
          isActive: true,
          serialNumber: data.serialNumber,
          adSku: data.adSku,
        },
      });
    } catch (error: any) {
      console.error('Error creating product:', error);
      throw new BadRequestException(error.message || 'Ошибка создания товара');
    }
  }

  async update(id: number, data: any) {
    try {
      const exists = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!exists) {
        throw new NotFoundException(`Товар #${id} не найден`);
      }

      const updateData: any = {};
      const validCategories = ['CONSOLE', 'ACCESSORY', 'DISK', 'SERVICE', 'SUBSCRIPTION_KEY'];
      
      if (data.name !== undefined) updateData.name = data.name;
      if (data.category !== undefined && validCategories.includes(data.category)) updateData.category = data.category;
      if (data.brand !== undefined) updateData.brand = data.brand;
      if (data.model !== undefined) updateData.model = data.model;
      if (data.version !== undefined) updateData.version = data.version;
      if (data.stock !== undefined) updateData.stock = Number(data.stock);
      if (data.costPrice !== undefined) updateData.costPrice = Number(data.costPrice);
      if (data.price !== undefined) updateData.price = Number(data.price);
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.serialNumber !== undefined) updateData.serialNumber = data.serialNumber;
      if (data.adSku !== undefined) updateData.adSku = data.adSku;

      return await this.prisma.product.update({
        where: { id },
        data: updateData,
      });
    } catch (error: any) {
      console.error('Error updating product:', error);
      throw new BadRequestException(error.message || 'Ошибка обновления товара');
    }
  }

  async remove(id: number) {
    try {
      const exists = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!exists) {
        throw new NotFoundException(`Товар #${id} не найден`);
      }

      return await this.prisma.product.delete({
        where: { id },
      });
    } catch (error: any) {
      console.error('Error removing product:', error);
      throw new BadRequestException(error.message || 'Ошибка удаления товара');
    }
  }

  async archive(id: number) {
    try {
      const exists = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!exists) {
        throw new NotFoundException(`Товар #${id} не найден`);
      }

      return await this.prisma.product.update({
        where: { id },
        data: {
          isActive: false,
          archivedAt: new Date(),
        },
      });
    } catch (error: any) {
      console.error('Error archiving product:', error);
      throw new BadRequestException(error.message);
    }
  }

  async unarchive(id: number) {
    try {
      const exists = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!exists) {
        throw new NotFoundException(`Товар #${id} не найден`);
      }

      return await this.prisma.product.update({
        where: { id },
        data: {
          isActive: true,
          archivedAt: null,
        },
      });
    } catch (error: any) {
      console.error('Error unarchiving product:', error);
      throw new BadRequestException(error.message);
    }
  }
}