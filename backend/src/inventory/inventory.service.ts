import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryUnitStatus, Prisma, ProductCategory } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma.service';

type NormalizedVariant = {
  key: string;
  label: string;
  memoryGb: number | null;
  price: number;
  costPrice: number | null;
  stock: number;
  inStock: boolean;
  isDefault: boolean;
};

type InventoryProductCard = {
  id: number;
  name: string;
  category: ProductCategory;
  storefrontCategory: string | null;
  brand: string | null;
  model: string | null;
  version: string | null;
  variants: Prisma.JsonValue | null;
  serialNumber: string | null;
};

type ResolveInput = {
  productId?: number;
  name?: string;
  brand?: string;
  model?: string;
  version?: string;
  category?: ProductCategory;
  variantKey?: string;
  memoryGb?: number;
};

type ResolvedBinding = {
  product: InventoryProductCard;
  variantKey: string | null;
  variantLabel: string | null;
  memoryGb: number | null;
};

type ConsumeUnitsParams = {
  productId: number;
  qty: number;
  orderId: number;
  orderItemId: number;
  variantKey?: string | null;
  salePriceOverride?: Prisma.Decimal | Decimal | number | string | null;
  mode: 'RESERVE' | 'SELL';
};

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  categories(): string[] {
    return Object.values(ProductCategory);
  }

  private toMoneyOrNull(v: any): Prisma.Decimal | null {
    if (v === null || v === undefined || v === '') return null;
    const d = new Decimal(v || 0);
    if (!d.isFinite()) {
      throw new BadRequestException('Некорректная сумма');
    }
    if (d.abs().gte(1e8)) {
      throw new BadRequestException('Слишком большая сумма. Максимум 99 999 999.99');
    }
    if (d.lt(0)) {
      throw new BadRequestException('Сумма не может быть отрицательной');
    }
    return new Prisma.Decimal(d.toFixed(2));
  }

  private normalizeText(input?: string | null): string {
    return String(input || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeVariantKey(input?: string | null): string | null {
    const value = String(input || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    return value || null;
  }

  private tokenize(input?: string | null): string[] {
    const normalized = this.normalizeText(input);
    if (!normalized) return [];
    return normalized.split(' ').filter(Boolean);
  }

  private parseMemoryGb(input: string): number | null {
    const text = this.normalizeText(input);
    if (!text) return null;

    const tbMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(tb|тб|тера|терабайт)/i);
    if (tbMatch) {
      const raw = Number(String(tbMatch[1]).replace(',', '.'));
      if (Number.isFinite(raw) && raw > 0) {
        return Math.round(raw * 1024);
      }
    }

    const gbMatch = text.match(/(\d{2,4})\s*(gb|гб)/i);
    if (gbMatch) {
      const raw = Number(gbMatch[1]);
      if (Number.isFinite(raw) && raw > 0) {
        return Math.round(raw);
      }
    }

    return null;
  }

  private normalizeVariants(
    input: unknown,
    fallback?: {
      price?: number | string | Prisma.Decimal | null;
      costPrice?: number | string | Prisma.Decimal | null;
    },
  ): NormalizedVariant[] {
    if (!Array.isArray(input)) return [];

    const used = new Set<string>();
    const rows: NormalizedVariant[] = [];

    for (const raw of input) {
      if (!raw || typeof raw !== 'object') continue;
      const row = raw as Record<string, unknown>;
      const key = this.normalizeVariantKey(String(row.key || ''));
      if (!key || used.has(key)) continue;

      const memoryRaw = Number(row.memoryGb ?? NaN);
      const memoryGb = Number.isFinite(memoryRaw) && memoryRaw > 0 ? Math.round(memoryRaw) : null;
      const label = String(row.label || key).trim() || key;
      const priceRaw = Number(row.price ?? fallback?.price ?? 0);
      const price = Number.isFinite(priceRaw) && priceRaw >= 0 ? priceRaw : 0;
      const costPriceRaw = Number(row.costPrice ?? fallback?.costPrice ?? NaN);
      const costPrice = Number.isFinite(costPriceRaw) && costPriceRaw >= 0 ? costPriceRaw : null;
      const stock = Math.max(0, Math.floor(Number(row.stock ?? 0)));
      const inStock = row.inStock !== undefined ? Boolean(row.inStock) : stock > 0;
      const isDefault = Boolean(row.isDefault);

      rows.push({
        key,
        label,
        memoryGb,
        price,
        costPrice,
        stock,
        inStock,
        isDefault,
      });
      used.add(key);
    }

    if (rows.length > 0 && !rows.some(row => row.isDefault)) {
      rows[0].isDefault = true;
    }

    return rows;
  }

  private candidateScore(
    product: InventoryProductCard,
    query: {
      combinedText: string;
      brand: string;
      model: string;
      category?: ProductCategory;
      memoryGb: number | null;
    },
  ): number {
    const sourceText = query.combinedText;
    const sourceTokens = new Set(this.tokenize(sourceText));

    const productName = this.normalizeText(product.name);
    const productBrand = this.normalizeText(product.brand);
    const productModel = this.normalizeText(product.model);
    const productVersion = this.normalizeText(product.version);
    const productText = [productName, productBrand, productModel, productVersion]
      .filter(Boolean)
      .join(' ');
    const productTokens = new Set(this.tokenize(productText));

    let score = 0;

    if (query.category && product.category === query.category) {
      score += 3;
    }

    if (query.brand && productBrand) {
      if (query.brand === productBrand) score += 8;
      else if (query.brand.includes(productBrand) || productBrand.includes(query.brand)) score += 4;
      else score -= 4;
    }

    if (query.model) {
      if (productModel && query.model.includes(productModel)) score += 10;
      if (productName && query.model.includes(productName)) score += 7;
      if (productModel && productModel.includes(query.model)) score += 5;
      if (productName && productName.includes(query.model)) score += 4;
    }

    if (sourceText) {
      if (productName && sourceText.includes(productName)) score += 6;
      if (productModel && sourceText.includes(productModel)) score += 7;
    }

    let overlap = 0;
    for (const token of sourceTokens) {
      if (productTokens.has(token)) overlap += 1;
    }
    score += Math.min(6, overlap);

    const variants = this.normalizeVariants(product.variants);
    if (query.memoryGb && variants.length > 0) {
      const variantMemories = variants
        .map(variant => variant.memoryGb)
        .filter((value): value is number => typeof value === 'number' && value > 0);
      if (variantMemories.length > 0) {
        const nearestDiff = Math.min(
          ...variantMemories.map(value => Math.abs(value - query.memoryGb!)),
        );
        if (nearestDiff <= 32) score += 6;
        else if (nearestDiff <= 128) score += 4;
        else if (nearestDiff <= 256) score += 2;
        else score -= 3;
      }
    }

    return score;
  }

  private resolveVariant(
    product: InventoryProductCard,
    dto: ResolveInput,
  ): {
    variantKey: string | null;
    variantLabel: string | null;
    memoryGb: number | null;
  } {
    const variants = this.normalizeVariants(product.variants);
    if (!variants.length) {
      return {
        variantKey: null,
        variantLabel: null,
        memoryGb: dto.memoryGb ?? null,
      };
    }

    const normalizedVariantKey = this.normalizeVariantKey(dto.variantKey);
    if (normalizedVariantKey) {
      const byKey = variants.find(variant => variant.key === normalizedVariantKey);
      if (!byKey) {
        throw new BadRequestException(
          `Для карточки ${product.name} не найден вариант ${normalizedVariantKey}`,
        );
      }
      return {
        variantKey: byKey.key,
        variantLabel: byKey.label,
        memoryGb: byKey.memoryGb,
      };
    }

    const combinedText = [dto.name, dto.brand, dto.model, dto.version].filter(Boolean).join(' ');
    const memoryGb =
      Number.isFinite(Number(dto.memoryGb)) && Number(dto.memoryGb) > 0
        ? Math.round(Number(dto.memoryGb))
        : this.parseMemoryGb(combinedText);

    if (memoryGb) {
      const withMemory = variants
        .filter(variant => typeof variant.memoryGb === 'number' && variant.memoryGb > 0)
        .sort((a, b) => {
          const aDiff = Math.abs(Number(a.memoryGb || 0) - memoryGb);
          const bDiff = Math.abs(Number(b.memoryGb || 0) - memoryGb);
          if (aDiff === bDiff) return a.key.localeCompare(b.key, 'en');
          return aDiff - bDiff;
        });

      if (withMemory.length > 0) {
        const best = withMemory[0];
        return {
          variantKey: best.key,
          variantLabel: best.label,
          memoryGb: best.memoryGb,
        };
      }
    }

    const defaultVariant = variants.find(variant => variant.isDefault) || variants[0];
    return {
      variantKey: defaultVariant.key,
      variantLabel: defaultVariant.label,
      memoryGb: defaultVariant.memoryGb,
    };
  }

  private async createWarehouseProductFromInput(dto: {
    name?: string;
    brand?: string;
    model?: string;
    version?: string;
    category?: ProductCategory;
    purchasePrice?: number;
    price?: number;
  }): Promise<InventoryProductCard> {
    const name =
      String(dto.name || '').trim() || String(dto.model || '').trim() || 'Складская позиция';

    const created = await this.prisma.product.create({
      data: {
        tenant: 'TECHNOPRIME',
        name,
        category: dto.category || ProductCategory.CONSOLE,
        condition: 'USED',
        brand: String(dto.brand || '').trim() || null,
        model: String(dto.model || '').trim() || null,
        version: String(dto.version || '').trim() || null,
        storefrontCategory: null,
        stock: 0,
        inStock: false,
        isAlwaysAvailable: false,
        isActive: true,
        isArchived: false,
        price: this.toMoneyOrNull(dto.price) || new Prisma.Decimal(0),
        costPrice: this.toMoneyOrNull(dto.purchasePrice) || new Prisma.Decimal(0),
      },
      select: {
        id: true,
        name: true,
        category: true,
        storefrontCategory: true,
        brand: true,
        model: true,
        version: true,
        variants: true,
        serialNumber: true,
      },
    });

    return created;
  }

  private async resolveProductBinding(dto: ResolveInput): Promise<ResolvedBinding> {
    const explicitProductId = Number(dto.productId || 0);
    if (explicitProductId > 0) {
      const product = await this.prisma.product.findUnique({
        where: { id: explicitProductId },
        select: {
          id: true,
          name: true,
          category: true,
          storefrontCategory: true,
          brand: true,
          model: true,
          version: true,
          variants: true,
          serialNumber: true,
        },
      });
      if (!product || product.serialNumber) {
        throw new NotFoundException('Карточка для привязки не найдена');
      }
      if (product.storefrontCategory) {
        throw new BadRequestException(
          'На склад нельзя добавлять напрямую в карточку витрины. Добавьте в складскую позицию и прикрепите из раздела Витрина.',
        );
      }
      const resolvedVariant = this.resolveVariant(product, dto);
      return {
        product,
        ...resolvedVariant,
      };
    }

    const combinedText = [dto.name, dto.brand, dto.model, dto.version].filter(Boolean).join(' ');
    const normalizedCombined = this.normalizeText(combinedText);
    if (!normalizedCombined) {
      throw new BadRequestException(
        'Нужны ключи для авто-привязки (name/model/brand) или явный productId',
      );
    }

    const cards = await this.prisma.product.findMany({
      where: {
        tenant: 'TECHNOPRIME',
        isActive: true,
        isArchived: false,
        serialNumber: null,
        storefrontCategory: null,
      },
      select: {
        id: true,
        name: true,
        category: true,
        storefrontCategory: true,
        brand: true,
        model: true,
        version: true,
        variants: true,
        serialNumber: true,
      },
      orderBy: { id: 'asc' },
    });

    if (!cards.length) {
      throw new BadRequestException('В каталоге нет карточек для привязки');
    }

    const desiredCategory = dto.category;
    const desiredBrand = this.normalizeText(dto.brand);
    const desiredModel = this.normalizeText(dto.model || dto.name);
    const memoryGb =
      Number.isFinite(Number(dto.memoryGb)) && Number(dto.memoryGb) > 0
        ? Math.round(Number(dto.memoryGb))
        : this.parseMemoryGb(combinedText);

    const ranked = cards
      .map(product => ({
        product,
        score: this.candidateScore(product, {
          combinedText: normalizedCombined,
          brand: desiredBrand,
          model: desiredModel,
          category: desiredCategory,
          memoryGb,
        }),
      }))
      .sort((a, b) => {
        if (a.score === b.score) return a.product.id - b.product.id;
        return b.score - a.score;
      });

    const best = ranked[0];
    if (!best || best.score < 6) {
      throw new BadRequestException(
        'Не удалось автоматически привязать складскую единицу к карточке. Укажи точнее модель/объем или productId.',
      );
    }

    const resolvedVariant = this.resolveVariant(best.product, {
      ...dto,
      memoryGb: memoryGb ?? undefined,
    });

    return {
      product: best.product,
      ...resolvedVariant,
    };
  }

  private withClient(tx?: Prisma.TransactionClient): PrismaService | Prisma.TransactionClient {
    return tx || this.prisma;
  }

  private getTrackedVariantKeys(product?: { variants?: Prisma.JsonValue | null }): string[] {
    if (!product) return [];
    return this.normalizeVariants(product.variants).map(variant => variant.key);
  }

  private buildAvailableUnitsWhere(
    product: { id: number; storefrontCategory?: string | null; variants?: Prisma.JsonValue | null },
    options?: { variantKey?: string | null },
  ): Prisma.InventoryUnitWhereInput {
    const where: Prisma.InventoryUnitWhereInput = {
      tenant: 'TECHNOPRIME',
      status: InventoryUnitStatus.AVAILABLE,
    };

    const trackedVariantKeys = this.getTrackedVariantKeys(product);
    const variantKey =
      options?.variantKey === undefined ? undefined : this.normalizeVariantKey(options.variantKey);
    if (variantKey) {
      if (trackedVariantKeys.length > 0 && !trackedVariantKeys.includes(variantKey)) {
        where.id = -1;
        return where;
      }
      where.variantKey = variantKey;
    } else if (trackedVariantKeys.length > 0) {
      where.variantKey = {
        in: trackedVariantKeys,
      };
    }

    if (product.storefrontCategory) {
      where.OR = [
        {
          productId: product.id,
          product: {
            is: {
              isActive: true,
              isArchived: false,
            },
          },
        },
        {
          storefrontProductId: product.id,
          product: {
            is: {
              isActive: true,
              isArchived: false,
            },
          },
          storefrontProduct: {
            is: {
              isActive: true,
              isArchived: false,
            },
          },
        },
      ];
      return where;
    }

    where.productId = product.id;
    where.product = {
      is: {
        isActive: true,
        isArchived: false,
      },
    };
    return where;
  }

  async countAvailableUnitsForProduct(
    params: { productId: number; variantKey?: string | null },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.withClient(tx);
    const productId = Number(params.productId || 0);
    if (!productId) {
      throw new BadRequestException('productId is required');
    }

    const product = await client.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        storefrontCategory: true,
        variants: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Товар не найден');
    }

    return client.inventoryUnit.count({
      where: this.buildAvailableUnitsWhere(product, {
        variantKey: params.variantKey,
      }),
    });
  }

  async recalcProductAvailability(productId: number, tx?: Prisma.TransactionClient) {
    const client = this.withClient(tx);

    const product = await client.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        storefrontCategory: true,
        price: true,
        costPrice: true,
        stock: true,
        inStock: true,
        isAlwaysAvailable: true,
        variants: true,
      },
    });

    if (!product) return null;

    const availableUnits = await client.inventoryUnit.findMany({
      where: this.buildAvailableUnitsWhere(product),
      select: {
        id: true,
        variantKey: true,
      },
    });

    const totalStock = availableUnits.length;
    const variants = this.normalizeVariants(product.variants, {
      price: product.price,
      costPrice: product.costPrice,
    });

    if (variants.length > 0) {
      const countByVariant = new Map<string, number>();
      for (const unit of availableUnits) {
        const key = this.normalizeVariantKey(unit.variantKey);
        if (!key) continue;
        countByVariant.set(key, (countByVariant.get(key) || 0) + 1);
      }

      const nextVariants = variants.map(variant => {
        const nextStock = countByVariant.get(variant.key) || 0;
        return {
          ...variant,
          stock: nextStock,
          inStock: nextStock > 0,
        };
      });

      const nextInStock = product.isAlwaysAvailable
        ? true
        : nextVariants.some(variant => Boolean((variant as any).inStock));

      return client.product.update({
        where: { id: productId },
        data: {
          variants: nextVariants as any,
          stock: totalStock,
          inStock: nextInStock,
        },
      });
    }

    return client.product.update({
      where: { id: productId },
      data: {
        stock: totalStock,
        inStock: product.isAlwaysAvailable ? true : totalStock > 0,
      },
    });
  }

  async recalcProductsAvailability(productIds: number[], tx?: Prisma.TransactionClient) {
    const ids = Array.from(
      new Set(
        (productIds || [])
          .map(value => Number(value))
          .filter(value => Number.isFinite(value) && value > 0),
      ),
    );
    if (!ids.length) return;

    for (const productId of ids) {
      await this.recalcProductAvailability(productId, tx);
    }
  }

  async create(dto: {
    serialNumber?: string;
    productId?: number;
    name?: string;
    brand?: string;
    model?: string;
    version?: string;
    category?: ProductCategory;
    memoryGb?: number;
    variantKey?: string;
    purchasePrice?: number;
    price?: number;
    notes?: string;
  }) {
    const serialNumber = String(dto.serialNumber || '').trim() || null;

    if (serialNumber) {
      const exists = await this.prisma.inventoryUnit.findUnique({
        where: { serialNumber },
        select: { id: true },
      });
      if (exists) {
        throw new ConflictException('Серийный номер уже существует на складе');
      }
    }

    let binding: ResolvedBinding;
    try {
      binding = await this.resolveProductBinding({
        productId: dto.productId,
        name: dto.name,
        brand: dto.brand,
        model: dto.model,
        version: dto.version,
        category: dto.category,
        memoryGb: dto.memoryGb,
        variantKey: dto.variantKey,
      });
    } catch (error) {
      const explicitProductId = Number(dto.productId || 0);
      const hasAutoKeys = [dto.name, dto.brand, dto.model, dto.version, serialNumber].some(value =>
        Boolean(String(value || '').trim()),
      );

      if (explicitProductId > 0 || !hasAutoKeys) {
        throw error;
      }

      const createdWarehouseProduct = await this.createWarehouseProductFromInput({
        name: dto.name || dto.model || serialNumber || 'Складская позиция',
        brand: dto.brand,
        model: dto.model,
        version: dto.version,
        category: dto.category,
        purchasePrice: dto.purchasePrice,
        price: dto.price,
      });
      const resolvedVariant = this.resolveVariant(createdWarehouseProduct, {
        ...dto,
      });
      binding = {
        product: createdWarehouseProduct,
        ...resolvedVariant,
      };
    }

    if (dto.category && dto.category !== binding.product.category) {
      throw new BadRequestException(
        `Категория не совпадает с карточкой (${binding.product.category})`,
      );
    }

    const displayName =
      String(dto.name || '').trim() ||
      String(dto.model || '').trim() ||
      String(binding.product.name || '').trim() ||
      serialNumber ||
      `unit-${Date.now()}`;

    const created = await this.prisma.inventoryUnit.create({
      data: {
        tenant: 'TECHNOPRIME',
        productId: binding.product.id,
        storefrontProductId: null,
        category: binding.product.category,
        brand: dto.brand?.trim() || binding.product.brand || null,
        model: dto.model?.trim() || binding.product.model || null,
        version: dto.version?.trim() || binding.product.version || null,
        displayName,
        serialNumber,
        variantKey: binding.variantKey,
        variantLabel: binding.variantLabel,
        memoryGb: binding.memoryGb,
        status: InventoryUnitStatus.AVAILABLE,
        purchasePrice: this.toMoneyOrNull(dto.purchasePrice),
        salePrice: this.toMoneyOrNull(dto.price),
        notes: String(dto.notes || '').trim() || null,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            brand: true,
            model: true,
            version: true,
            storefrontCategory: true,
          },
        },
      },
    });

    await this.recalcProductAvailability(binding.product.id);

    return created;
  }

  async list(query?: {
    q?: string;
    status?: string;
    productId?: string | number;
    page?: string | number;
    limit?: string | number;
  }) {
    const where: Prisma.InventoryUnitWhereInput = {
      tenant: 'TECHNOPRIME',
    };

    const statusRaw = String(query?.status || '')
      .trim()
      .toUpperCase();
    if (statusRaw && statusRaw !== 'ALL') {
      if (!(statusRaw in InventoryUnitStatus)) {
        throw new BadRequestException('Некорректный статус');
      }
      where.status = statusRaw as InventoryUnitStatus;
    }

    const productId = Number(query?.productId || 0);
    if (Number.isFinite(productId) && productId > 0) {
      where.productId = productId;
    }

    const q = String(query?.q || '').trim();
    if (q) {
      where.OR = [
        { serialNumber: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { version: { contains: q, mode: 'insensitive' } },
        { variantLabel: { contains: q, mode: 'insensitive' } },
        { product: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const page = Math.max(1, Number(query?.page || 1));
    const limit = Math.min(500, Math.max(1, Number(query?.limit || 200)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.inventoryUnit.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ attachedAt: 'desc' }, { id: 'desc' }],
        include: {
          product: {
            select: {
              id: true,
              name: true,
              storefrontCategory: true,
              category: true,
            },
          },
        },
      }),
      this.prisma.inventoryUnit.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      success: true,
    };
  }

  async remove(id: number) {
    if (!Number.isFinite(id) || id <= 0) {
      throw new BadRequestException('Некорректный id');
    }

    const unit = await this.prisma.inventoryUnit.findUnique({
      where: { id },
      select: {
        id: true,
        productId: true,
        storefrontProductId: true,
        status: true,
      },
    });

    if (!unit) {
      throw new NotFoundException('Складская единица не найдена');
    }

    if (unit.status === InventoryUnitStatus.RESERVED) {
      throw new BadRequestException('Нельзя удалить зарезервированную складскую единицу');
    }
    if (unit.status === InventoryUnitStatus.SOLD) {
      throw new BadRequestException('Нельзя удалить проданную складскую единицу');
    }

    await this.prisma.$transaction(async tx => {
      await tx.inventoryUnit.delete({ where: { id: unit.id } });
      await this.recalcProductsAvailability(
        [unit.productId, Number(unit.storefrontProductId || 0)],
        tx,
      );
    });

    return { success: true, id: unit.id };
  }

  async getBySerial(serial: string) {
    const serialNumber = String(serial || '').trim();
    if (!serialNumber) {
      throw new BadRequestException('Серийный номер обязателен');
    }

    const unit = await this.prisma.inventoryUnit.findFirst({
      where: {
        serialNumber,
        status: InventoryUnitStatus.AVAILABLE,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            costPrice: true,
            category: true,
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException('Товар не найден или не в наличии');
    }

    return {
      inventoryUnitId: unit.id,
      serialNumber: unit.serialNumber,
      productId: unit.productId,
      variantKey: unit.variantKey,
      variantLabel: unit.variantLabel,
      name: unit.product.name,
      price: unit.product.price,
      costPrice: unit.product.costPrice,
      category: unit.product.category,
    };
  }

  async listAvailableForStoreProduct(params: {
    productId: number;
    variantKey?: string | null;
    limit?: number;
  }) {
    const productId = Number(params.productId || 0);
    if (!productId) {
      throw new BadRequestException('productId is required');
    }

    const variantKey =
      params.variantKey === undefined ? undefined : this.normalizeVariantKey(params.variantKey);
    const targetProduct = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        storefrontCategory: true,
        variants: true,
      },
    });
    if (!targetProduct) {
      throw new NotFoundException('Товар не найден');
    }

    const items = await this.prisma.inventoryUnit.findMany({
      where: this.buildAvailableUnitsWhere(targetProduct, { variantKey }),
      orderBy: [{ attachedAt: 'asc' }, { id: 'asc' }],
      take: Math.min(100, Math.max(1, Number(params.limit || 30))),
      select: {
        id: true,
        serialNumber: true,
        displayName: true,
        variantKey: true,
        variantLabel: true,
        memoryGb: true,
        salePrice: true,
        previousSalePrice: true,
        productId: true,
        storefrontProductId: true,
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            model: true,
            version: true,
          },
        },
      },
    });

    return items;
  }

  async reserveSpecificUnit(
    tx: Prisma.TransactionClient,
    params: {
      inventoryUnitId: number;
      productId: number;
      orderId: number;
      orderItemId: number;
      variantKey?: string | null;
      salePriceOverride?: Prisma.Decimal | Decimal | number | string | null;
    },
  ) {
    const inventoryUnitId = Number(params.inventoryUnitId || 0);
    if (!inventoryUnitId) {
      throw new BadRequestException('inventoryUnitId is required');
    }

    const variantKey =
      params.variantKey === undefined ? undefined : this.normalizeVariantKey(params.variantKey);
    const targetProduct = await tx.product.findUnique({
      where: { id: params.productId },
      select: {
        id: true,
        storefrontCategory: true,
        variants: true,
      },
    });
    if (!targetProduct) {
      throw new NotFoundException('Товар для резервирования не найден');
    }

    const unit = await tx.inventoryUnit.findFirst({
      where: {
        id: inventoryUnitId,
        ...this.buildAvailableUnitsWhere(targetProduct, { variantKey }),
      },
      select: {
        id: true,
        productId: true,
        storefrontProductId: true,
        salePrice: true,
      },
    });

    if (!unit) {
      throw new NotFoundException('Эта складская единица недоступна для выбранного предзаказа');
    }

    const salePriceOverride = this.toMoneyOrNull(params.salePriceOverride);
    const updated = await tx.inventoryUnit.update({
      where: { id: unit.id },
      data: {
        status: InventoryUnitStatus.RESERVED,
        orderId: params.orderId,
        orderItemId: params.orderItemId,
        reservedAt: new Date(),
        soldAt: null,
        ...(salePriceOverride !== null
          ? {
              previousSalePrice: unit.salePrice,
              salePrice: salePriceOverride,
            }
          : {}),
      },
      select: {
        id: true,
        productId: true,
        storefrontProductId: true,
        serialNumber: true,
      },
    });

    await this.recalcProductsAvailability(
      [updated.productId, Number(updated.storefrontProductId || 0), params.productId],
      tx,
    );

    return updated;
  }

  async consumeAvailableUnits(
    tx: Prisma.TransactionClient,
    params: ConsumeUnitsParams,
  ): Promise<Array<{ id: number; productId: number; storefrontProductId: number | null }>> {
    const qty = Math.max(1, Math.floor(Number(params.qty || 1)));
    const variantKey =
      params.variantKey === undefined ? undefined : this.normalizeVariantKey(params.variantKey);

    const targetProduct = await tx.product.findUnique({
      where: { id: params.productId },
      select: {
        id: true,
        storefrontCategory: true,
        variants: true,
      },
    });
    if (!targetProduct) {
      throw new NotFoundException('Товар для списания не найден');
    }

    const picked = await tx.inventoryUnit.findMany({
      where: this.buildAvailableUnitsWhere(targetProduct, { variantKey }),
      orderBy: [{ attachedAt: 'asc' }, { id: 'asc' }],
      take: qty,
      select: {
        id: true,
        productId: true,
        storefrontProductId: true,
        salePrice: true,
      },
    });

    if (picked.length < qty) {
      throw new BadRequestException('Недостаточно складских единиц в наличии');
    }

    const ids = picked.map(unit => unit.id);
    const now = new Date();
    const salePriceOverride = this.toMoneyOrNull(params.salePriceOverride);

    if (params.mode === 'RESERVE') {
      if (salePriceOverride !== null) {
        await Promise.all(
          picked.map(unit =>
            tx.inventoryUnit.update({
              where: { id: unit.id },
              data: {
                status: InventoryUnitStatus.RESERVED,
                orderId: params.orderId,
                orderItemId: params.orderItemId,
                reservedAt: now,
                soldAt: null,
                previousSalePrice: unit.salePrice,
                salePrice: salePriceOverride,
              },
            }),
          ),
        );
      } else {
        await tx.inventoryUnit.updateMany({
          where: { id: { in: ids } },
          data: {
            status: InventoryUnitStatus.RESERVED,
            orderId: params.orderId,
            orderItemId: params.orderItemId,
            reservedAt: now,
            soldAt: null,
          },
        });
      }
    } else {
      await tx.inventoryUnit.updateMany({
        where: { id: { in: ids } },
        data: {
          status: InventoryUnitStatus.SOLD,
          orderId: params.orderId,
          orderItemId: params.orderItemId,
          soldAt: now,
        },
      });
    }

    const affectedProductIds = new Set<number>();
    for (const unit of picked) {
      affectedProductIds.add(unit.productId);
      if (unit.storefrontProductId) {
        affectedProductIds.add(unit.storefrontProductId);
      }
    }
    affectedProductIds.add(params.productId);
    await this.recalcProductsAvailability(Array.from(affectedProductIds), tx);
    return picked;
  }

  async finalizeReservedOrderUnits(tx: Prisma.TransactionClient, orderId: number) {
    const rows = await tx.inventoryUnit.findMany({
      where: {
        tenant: 'TECHNOPRIME',
        orderId,
        status: InventoryUnitStatus.RESERVED,
      },
      select: {
        id: true,
        productId: true,
        storefrontProductId: true,
        previousSalePrice: true,
      },
    });

    if (!rows.length) return 0;

    await tx.inventoryUnit.updateMany({
      where: {
        id: { in: rows.map(row => row.id) },
      },
      data: {
        status: InventoryUnitStatus.SOLD,
        soldAt: new Date(),
        previousSalePrice: null,
      },
    });

    await this.recalcProductsAvailability(
      rows.flatMap(row => [row.productId, Number(row.storefrontProductId || 0)]),
      tx,
    );
    return rows.length;
  }

  async releaseOrderUnits(
    tx: Prisma.TransactionClient,
    orderId: number,
    mode: 'RESERVED_ONLY' | 'ANY_SOLD_OR_RESERVED' = 'RESERVED_ONLY',
  ) {
    const statuses =
      mode === 'ANY_SOLD_OR_RESERVED'
        ? [InventoryUnitStatus.RESERVED, InventoryUnitStatus.SOLD]
        : [InventoryUnitStatus.RESERVED];

    const rows = await tx.inventoryUnit.findMany({
      where: {
        tenant: 'TECHNOPRIME',
        orderId,
        status: { in: statuses },
      },
      select: {
        id: true,
        productId: true,
        storefrontProductId: true,
        previousSalePrice: true,
      },
    });

    if (!rows.length) return 0;

    await Promise.all(
      rows.map(row =>
        tx.inventoryUnit.update({
          where: { id: row.id },
          data: {
            status: InventoryUnitStatus.AVAILABLE,
            orderId: null,
            orderItemId: null,
            reservedAt: null,
            soldAt: null,
            salePrice: row.previousSalePrice,
            previousSalePrice: null,
          },
        }),
      ),
    );

    await this.recalcProductsAvailability(
      rows.flatMap(row => [row.productId, Number(row.storefrontProductId || 0)]),
      tx,
    );
    return rows.length;
  }
}
