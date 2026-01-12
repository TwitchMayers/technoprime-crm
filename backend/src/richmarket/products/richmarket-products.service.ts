import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Prisma, Tenant, ClothingCategory, ClothingSize } from '@prisma/client';


@Injectable()
export class RichMarketProductsService {
  constructor(private prisma: PrismaService) {}

  async list(query?: { 
    category?: string; 
    brand?: string; 
    color?: string;
    q?: string;
    isArchived?: boolean | string;
  }) {
    const where: Prisma.RichMarketProductWhereInput = {
      tenant: Tenant.RICHMARKET,
    };

    if (query?.isArchived !== undefined) {
      where.isActive = query.isArchived === 'true' || query.isArchived === true;
    }

    if (query?.category && query.category in ClothingCategory) {
      where.category = query.category as ClothingCategory;
    }

    if (query?.brand) {
      where.brand = { contains: query.brand, mode: 'insensitive' };
    }

    if (query?.color) {
      where.color = { contains: query.color, mode: 'insensitive' };
    }

    if (query?.q) {
      where.OR = [
        { brand: { contains: query.q, mode: 'insensitive' } },
        { color: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.richMarketProduct.findMany({
      where,
      include: { 
        sizes: {
          orderBy: { size: 'asc'  } as any,
        },
      },
      orderBy: [
        { brand: 'asc' },
        { category: 'asc' },
      ],
    });
  }

  async create(data: {
    brand: string;
    category: string;
    color: string;
    imageUrl?: string;
    description?: string;
    costPrice: number;
    price: number;
    sizes: Array<{ size: string; stock: number }>;
  }) {
    if (!(data.category in ClothingCategory)) {
      throw new BadRequestException('Неверная категория');
    }

    return this.prisma.richMarketProduct.create({
      data: {
        tenant: Tenant.RICHMARKET,
        brand: data.brand,
        category: data.category as ClothingCategory,
        color: data.color,
        imageUrl: data.imageUrl,
        description: data.description,
        costPrice: data.costPrice,
        price: data.price,
        sizes: {
          create: data.sizes.map(s => ({
            size: s.size as ClothingSize,
            stock: s.stock,
          })),
        },
      },
      include: { sizes: true },
    });
  }

  async update(id: number, data: {
    brand?: string;
    category?: string;
    color?: string;
    costPrice?: number;
    price?: number;
    imageUrl?: string;
    description?: string;
    sizes?: Array<{ size: string; stock: number }>;
  }) {
    const updateData: any = {};
    
    if (data.brand !== undefined) updateData.brand = data.brand;
    if (data.category !== undefined) updateData.category = data.category as ClothingCategory;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.costPrice !== undefined) updateData.costPrice = data.costPrice;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.description !== undefined) updateData.description = data.description;

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.richMarketProduct.update({
        where: { id },
        data: updateData,
      });

      if (data.sizes && Array.isArray(data.sizes)) {
        await tx.richMarketProductSize.deleteMany({
          where: { productId: id }
        });

        for (const sizeData of data.sizes) {
          if (sizeData.size in ClothingSize && sizeData.stock > 0) {
            await tx.richMarketProductSize.create({
              data: {
                productId: id,
                size: sizeData.size as ClothingSize,
                stock: sizeData.stock,
              },
            });
          }
        }
      }

      return tx.richMarketProduct.findUnique({
        where: { id },
        include: { sizes: true },
      });
    });
  }

  async delete(id: number) {
    return this.prisma.richMarketProduct.delete({
      where: { id },
    });
  }

  async archive(id: number) {
    return this.prisma.richMarketProduct.update({
      where: { id },
      data: {
        isActive: true,
        archivedAt: new Date(),
      },
      include: { sizes: true },
    });
  }

  async unarchive(id: number) {
    return this.prisma.richMarketProduct.update({
      where: { id },
      data: {
        isActive: false,
        archivedAt: null,
      },
      include: { sizes: true },
    });
  }

  async getBrands() {
    const products = await this.prisma.richMarketProduct.findMany({
      where: { tenant: Tenant.RICHMARKET, isActive: false },
      select: { brand: true },
      distinct: ['brand'],
      orderBy: { brand: 'asc' },
    });

    return products.map(p => p.brand);
  }

  async getForOrder() {
    const products = await this.prisma.richMarketProduct.findMany({
      where: { 
        tenant: Tenant.RICHMARKET,
        isActive: false,
      },
      include: { 
        sizes: {
          where: { stock: { gt: 0  } as any },
          orderBy: { size: 'asc' },
        },
      },
    });

    const items: any[] = [];
    
    products.forEach(product => {
      product.sizes.forEach(sizeData => {
        items.push({
          id: `${product.id}_${sizeData.size}`,
          productId: product.id,
          sizeId: sizeData.id,
          brand: product.brand,
          category: product.category,
          color: product.color,
          size: sizeData.size,
          stock: sizeData.stock,
          price: Number(product.price),
          costPrice: Number(product.costPrice),
          imageUrl: product.imageUrl,
        });
      });
    });

    return items;
  }
}