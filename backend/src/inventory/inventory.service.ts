import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma, ProductCategory } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  categories(): string[] {
    return Object.values(ProductCategory);
  }

  private toMoney(v: any) {
    const d = new Decimal(v || 0);
    if (d.abs().gte(1e8)) {
      throw new BadRequestException('Слишком большая сумма. Максимум 99 999 999.99');
    }
    return new Prisma.Decimal(d.toFixed(2));
  }

async create(dto: {
  serialNumber: string;
  brand?: string;
  model?: string;
  category?: ProductCategory;
  purchasePrice?: number;
  price?: number;
  notes?: string;
}) {
  if (!dto.serialNumber?.trim()) {
    throw new BadRequestException('serialNumber обязателен');
  }

  const exists = await this.prisma.product.findUnique({
    where: { serialNumber: dto.serialNumber },
  });
  if (exists) throw new ConflictException('Серийный номер уже существует');

  const category = dto.category ?? (Object.values(ProductCategory)[0] as ProductCategory);
  const price = this.toMoney(dto.price ?? 0);
  const costPrice = this.toMoney(dto.purchasePrice ?? 0);

  try {
    const created = await this.prisma.product.create({
      data: {
        serialNumber: dto.serialNumber,
        name: dto.serialNumber,
        category,
        price,
        costPrice,
        stock: 1,
        isActive: false,
        brand: dto.brand ?? undefined,
        model: dto.model ?? undefined,
      },
    });
    return created;
  } catch (e: any) {
    throw new BadRequestException(e?.message || 'Ошибка сохранения товара');
  }
}

  async getBySerial(serial: string) {
    const product = await this.prisma.product.findFirst({
      where: { serialNumber: serial, stock: { gt: 0 }, isActive: false },
    });
    if (!product) throw new NotFoundException('Товар не найден или не в наличии');
    return product;
  }
}