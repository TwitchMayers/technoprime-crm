import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

export type ActiveStorePromotion = {
  blockId: number;
  productId: number;
  title: string;
  badge: string | null;
  promoPrice: number;
  promoOldPrice: number | null;
  promoEndsAt: string;
  promoRemainingSec: number;
  promoVariantKey: string | null;
  promoVariantLabel: string | null;
};

@Injectable()
export class ShopFeaturedService {
  constructor(private prisma: PrismaService) {}

  private seedPromise: Promise<void> | null = null;
  private relinkPromise: Promise<void> | null = null;

  private normalizeText(input?: string | null): string {
    return String(input || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenize(input?: string | null): string[] {
    const normalized = this.normalizeText(input);
    if (!normalized) return [];
    return normalized.split(' ').filter(Boolean);
  }

  private parseMemoryGb(input?: string | null): number | null {
    const text = this.normalizeText(input);
    if (!text) return null;

    const tbMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(tb|тб|тера|терабайт)/i);
    if (tbMatch) {
      const raw = Number(String(tbMatch[1]).replace(',', '.'));
      if (Number.isFinite(raw) && raw > 0) return Math.round(raw * 1024);
    }

    const gbMatch = text.match(/(\d{2,4})\s*(gb|гб)/i);
    if (gbMatch) {
      const raw = Number(gbMatch[1]);
      if (Number.isFinite(raw) && raw > 0) return Math.round(raw);
    }

    return null;
  }

  private normalizeVariantMemories(input: unknown): number[] {
    if (!Array.isArray(input)) return [];
    return input
      .map(row => {
        if (!row || typeof row !== 'object') return null;
        const memoryRaw = Number(row.memoryGb ?? NaN);
        if (!Number.isFinite(memoryRaw) || memoryRaw <= 0) return null;
        return Math.round(memoryRaw);
      })
      .filter((value): value is number => typeof value === 'number' && value > 0);
  }

  private parseDecimalInput(
    value: unknown,
    fieldName: string,
    options?: { allowZero?: boolean },
  ): Prisma.Decimal | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'string' && !value.trim()) return null;

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      throw new BadRequestException(`Поле ${fieldName} должно быть числом`);
    }

    const allowZero = options?.allowZero ?? true;
    if (allowZero ? numeric < 0 : numeric <= 0) {
      throw new BadRequestException(
        `Поле ${fieldName} должно быть больше ${allowZero ? 'или равно 0' : '0'}`,
      );
    }

    return new Prisma.Decimal(numeric);
  }

  private parsePromoEndsAt(value: unknown): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'string' && !value.trim()) return null;

    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Некорректная дата окончания акции');
    }
    return parsed;
  }

  private normalizeVariantKey(input?: string | null): string | null {
    const value = String(input || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    return value || null;
  }

  private normalizeProductVariants(input: unknown) {
    if (!Array.isArray(input)) return [];
    return input
      .map(row => {
        if (!row || typeof row !== 'object') return null;
        const key = this.normalizeVariantKey(row.key);
        const label = String(row.label || key || '').trim();
        const priceRaw = Number(row.price ?? NaN);
        const price = Number.isFinite(priceRaw) && priceRaw > 0 ? priceRaw : null;
        if (!key || !label) return null;
        return {
          key,
          label,
          price,
        };
      })
      .filter((row): row is { key: string; label: string; price: number | null } => Boolean(row));
  }

  private async resolvePromotionVariant(productId: number | null, variantKeyInput: unknown) {
    if (!productId) {
      return {
        key: null,
        label: null,
        price: null,
      };
    }

    const variantKey = this.normalizeVariantKey(
      variantKeyInput === undefined ? null : String(variantKeyInput || ''),
    );
    if (!variantKey) {
      return {
        key: null,
        label: null,
        price: null,
      };
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { variants: true },
    });
    const variants = this.normalizeProductVariants(product?.variants);
    const variant = variants.find(row => row.key === variantKey);

    if (!variant) {
      throw new BadRequestException('Для акции выберите существующую вариацию товара');
    }

    return {
      key: variant.key,
      label: variant.label,
      price: variant.price,
    };
  }

  private isPromoColumnsMissing(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code !== 'P2022') return false;
    const meta = JSON.stringify(error.meta || {}).toLowerCase();
    const message = String(error.message || '').toLowerCase();
    return meta.includes('promo') || message.includes('promo');
  }

  private mapPublicRow(row: {
    id: number;
    productId: number | null;
    kitId: number | null;
    title: string;
    subtitle: string | null;
    badge: string | null;
    priceOverride: Prisma.Decimal | null;
    position: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    promoBlock?: boolean;
    promoEnabled?: boolean;
    promoPrice?: Prisma.Decimal | null;
    promoOldPrice?: Prisma.Decimal | null;
    promoVariantKey?: string | null;
    promoVariantLabel?: string | null;
    promoEndsAt?: Date | null;
    product?: {
      id: number;
      name: string;
      price: Prisma.Decimal;
      coverImage: string | null;
      previewImage: string | null;
      brand: string | null;
      model: string | null;
      version: string | null;
    } | null;
    kit?: { id: number; name: string; tier: string | null } | null;
  }) {
    const now = Date.now();
    const promoEndsAtTs = row.promoEndsAt ? new Date(row.promoEndsAt).getTime() : 0;
    const promoActive =
      Boolean(row.promoBlock) &&
      Boolean(row.promoEnabled) &&
      row.promoPrice !== null &&
      promoEndsAtTs > now;

    const promoRemainingSec = promoActive
      ? Math.max(0, Math.floor((promoEndsAtTs - now) / 1000))
      : 0;
    const promoOldPrice = row.promoOldPrice ?? row.priceOverride ?? row.product?.price ?? null;

    return {
      ...row,
      promoBlock: Boolean(row.promoBlock),
      promoEnabled: Boolean(row.promoEnabled),
      promoEndsAt: row.promoEndsAt ?? null,
      isPromo: promoActive,
      promoRemainingSec,
      promoOldPrice: promoOldPrice ? promoOldPrice.toString() : null,
      promoPrice: row.promoPrice ? row.promoPrice.toString() : null,
      promoVariantKey: row.promoVariantKey ?? null,
      promoVariantLabel: row.promoVariantLabel ?? null,
      priceOverride: row.priceOverride ? row.priceOverride.toString() : null,
    };
  }

  async getActivePromotionMap(productIds: number[]) {
    const ids = Array.from(new Set(productIds.map(id => Number(id)).filter(id => id > 0)));
    if (!ids.length) {
      return new Map<number, ActiveStorePromotion>();
    }

    const now = Date.now();
    const rows = await this.prisma.shopFeaturedItem.findMany({
      where: {
        isActive: true,
        promoBlock: true,
        promoEnabled: true,
        promoPrice: { not: null },
        promoEndsAt: { gt: new Date(now) },
        productId: { in: ids },
        product: {
          is: {
            isActive: true,
            isArchived: false,
          },
        },
      },
      orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        productId: true,
        title: true,
        badge: true,
        promoPrice: true,
        promoOldPrice: true,
        promoEndsAt: true,
        promoVariantKey: true,
        promoVariantLabel: true,
      },
    });

    const result = new Map<number, ActiveStorePromotion>();
    for (const row of rows) {
      if (!row.productId || result.has(row.productId) || !row.promoPrice || !row.promoEndsAt) {
        continue;
      }

      const endsAtTs = new Date(row.promoEndsAt).getTime();
      if (!Number.isFinite(endsAtTs) || endsAtTs <= now) {
        continue;
      }

      result.set(row.productId, {
        blockId: row.id,
        productId: row.productId,
        title: row.title,
        badge: row.badge || null,
        promoPrice: Number(row.promoPrice),
        promoOldPrice: row.promoOldPrice ? Number(row.promoOldPrice) : null,
        promoEndsAt: row.promoEndsAt.toISOString(),
        promoRemainingSec: Math.max(0, Math.floor((endsAtTs - now) / 1000)),
        promoVariantKey: row.promoVariantKey || null,
        promoVariantLabel: row.promoVariantLabel || null,
      });
    }

    return result;
  }

  private async createLegacy(data: any) {
    const payload: Prisma.ShopFeaturedItemCreateInput = {
      title: data.title,
      subtitle: data.subtitle || null,
      badge: data.badge || null,
      position: Number(data.position || 0),
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      priceOverride: data.priceOverride ? new Prisma.Decimal(data.priceOverride) : undefined,
    };

    if (data.kitId) {
      payload.kit = { connect: { id: Number(data.kitId) } };
    } else if (data.productId) {
      payload.product = { connect: { id: Number(data.productId) } };
    }

    return this.prisma.shopFeaturedItem.create({ data: payload });
  }

  private async updateLegacy(id: number, data: any) {
    const exists = await this.prisma.shopFeaturedItem.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Карточка не найдена');
    }

    const payload: Prisma.ShopFeaturedItemUpdateInput = {
      title: data.title ?? undefined,
      subtitle: data.subtitle ?? undefined,
      badge: data.badge ?? undefined,
      position: data.position !== undefined ? Number(data.position) : undefined,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
      priceOverride:
        data.priceOverride !== undefined && data.priceOverride !== ''
          ? new Prisma.Decimal(data.priceOverride)
          : data.priceOverride === ''
            ? null
            : undefined,
    };

    if (data.kitId !== undefined) {
      if (data.kitId === null || data.kitId === '') {
        payload.kit = { disconnect: true };
      } else {
        payload.kit = { connect: { id: Number(data.kitId) } };
        payload.product = { disconnect: true };
      }
    }

    if (data.productId !== undefined) {
      if (data.productId === null || data.productId === '') {
        payload.product = { disconnect: true };
      } else {
        payload.product = { connect: { id: Number(data.productId) } };
        payload.kit = { disconnect: true };
      }
    }

    return this.prisma.shopFeaturedItem.update({
      where: { id },
      data: payload,
    });
  }

  private scoreFeaturedProductMatch(
    sourceText: string,
    sourceMemoryGb: number | null,
    product: {
      name: string | null;
      brand: string | null;
      model: string | null;
      version: string | null;
      variants: Prisma.JsonValue | null;
    },
  ) {
    const productName = this.normalizeText(product.name);
    const productBrand = this.normalizeText(product.brand);
    const productModel = this.normalizeText(product.model);
    const productVersion = this.normalizeText(product.version);
    const productText = [productName, productBrand, productModel, productVersion]
      .filter(Boolean)
      .join(' ');

    let score = 0;

    if (productName && sourceText === productName) score += 12;
    if (productName && sourceText.includes(productName)) score += 10;
    if (productModel && sourceText.includes(productModel)) score += 8;
    if (productVersion && sourceText.includes(productVersion)) score += 4;

    const sourceTokens = new Set(this.tokenize(sourceText));
    const productTokens = new Set(this.tokenize(productText));
    let overlap = 0;
    for (const token of sourceTokens) {
      if (productTokens.has(token)) overlap += 1;
    }
    score += Math.min(8, overlap);

    if (sourceMemoryGb) {
      const memories = this.normalizeVariantMemories(product.variants);
      if (memories.length > 0) {
        const nearestDiff = Math.min(...memories.map(value => Math.abs(value - sourceMemoryGb)));
        if (nearestDiff <= 32) score += 7;
        else if (nearestDiff <= 128) score += 4;
        else if (nearestDiff <= 256) score += 2;
      }
    }

    return score;
  }

  private async relinkOrphanFeaturedItems() {
    if (this.relinkPromise) return this.relinkPromise;

    this.relinkPromise = (async () => {
      const orphanItems = await this.prisma.shopFeaturedItem.findMany({
        where: {
          productId: null,
          kitId: null,
        },
        select: {
          id: true,
          title: true,
          subtitle: true,
        },
        orderBy: { id: 'asc' },
      });

      if (!orphanItems.length) return;

      const storefrontProducts = await this.prisma.product.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          isActive: true,
          isArchived: false,
          storefrontCategory: { not: null },
        },
        select: {
          id: true,
          name: true,
          brand: true,
          model: true,
          version: true,
          variants: true,
        },
        orderBy: { id: 'asc' },
      });

      if (!storefrontProducts.length) return;

      for (const item of orphanItems) {
        const source = [item.title, item.subtitle].filter(Boolean).join(' ');
        const sourceText = this.normalizeText(source);
        if (!sourceText) continue;

        const sourceMemoryGb = this.parseMemoryGb(source);
        const ranked = storefrontProducts
          .map(product => ({
            productId: product.id,
            score: this.scoreFeaturedProductMatch(sourceText, sourceMemoryGb, product),
          }))
          .sort((a, b) => {
            if (a.score === b.score) return a.productId - b.productId;
            return b.score - a.score;
          });

        const best = ranked[0];
        if (!best || best.score < 7) continue;

        await this.prisma.shopFeaturedItem.update({
          where: { id: item.id },
          data: { productId: best.productId },
        });
      }
    })()
      .catch(error => {
        this.relinkPromise = null;
        throw error;
      })
      .finally(() => {
        this.relinkPromise = null;
      });

    return this.relinkPromise;
  }

  private async ensureSeededFeaturedItems() {
    if (this.seedPromise) return this.seedPromise;

    this.seedPromise = (async () => {
      const total = await this.prisma.shopFeaturedItem.count();
      if (total > 0) return;

      const products = await this.prisma.product.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          isActive: true,
          isArchived: false,
          storefrontCategory: { not: null },
        },
        select: {
          id: true,
          name: true,
          shortDescription: true,
        },
        orderBy: [{ storefrontCategory: 'asc' }, { id: 'asc' }],
        take: 12,
      });

      if (!products.length) return;

      await this.prisma.shopFeaturedItem.createMany({
        data: products.map((product, index) => ({
          productId: product.id,
          title: product.name,
          subtitle: product.shortDescription || null,
          badge: null,
          position: index,
          isActive: true,
        })),
      });
    })()
      .catch(error => {
        this.seedPromise = null;
        throw error;
      })
      .finally(() => {
        this.seedPromise = null;
      });

    return this.seedPromise;
  }

  async listPublic() {
    await this.ensureSeededFeaturedItems();
    await this.relinkOrphanFeaturedItems();

    try {
      const rows = await this.prisma.shopFeaturedItem.findMany({
        where: {
          isActive: true,
          OR: [
            { productId: null },
            { kitId: { not: null } },
            {
              product: {
                is: {
                  isActive: true,
                  isArchived: false,
                },
              },
            },
          ],
        },
        orderBy: { position: 'asc' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              coverImage: true,
              previewImage: true,
              brand: true,
              model: true,
              version: true,
            },
          },
          kit: { select: { id: true, name: true, tier: true } },
        },
      });
      return rows.map(item => this.mapPublicRow(item));
    } catch (error) {
      if (!this.isPromoColumnsMissing(error)) throw error;
      const rows = await this.prisma.shopFeaturedItem.findMany({
        where: {
          isActive: true,
          OR: [
            { productId: null },
            { kitId: { not: null } },
            {
              product: {
                is: {
                  isActive: true,
                  isArchived: false,
                },
              },
            },
          ],
        },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          productId: true,
          kitId: true,
          title: true,
          subtitle: true,
          badge: true,
          priceOverride: true,
          position: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          promoVariantKey: true,
          promoVariantLabel: true,
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              coverImage: true,
              previewImage: true,
              brand: true,
              model: true,
              version: true,
            },
          },
          kit: { select: { id: true, name: true, tier: true } },
        },
      });
      return rows.map(item => this.mapPublicRow(item));
    }
  }

  async listAdmin() {
    await this.ensureSeededFeaturedItems();
    await this.relinkOrphanFeaturedItems();

    try {
      return await this.prisma.shopFeaturedItem.findMany({
        orderBy: { position: 'asc' },
        include: { product: true, kit: true },
      });
    } catch (error) {
      if (!this.isPromoColumnsMissing(error)) throw error;
      const rows = await this.prisma.shopFeaturedItem.findMany({
        orderBy: { position: 'asc' },
        select: {
          id: true,
          productId: true,
          kitId: true,
          title: true,
          subtitle: true,
          badge: true,
          priceOverride: true,
          position: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          product: true,
          kit: true,
        },
      });
      return rows.map(row => ({
        ...row,
        promoBlock: false,
        promoEnabled: false,
        promoPrice: null,
        promoOldPrice: null,
        promoEndsAt: null,
        promoRemainingSec: 0,
        isPromo: false,
        promoVariantKey: null,
        promoVariantLabel: null,
      }));
    }
  }

  async create(data: any) {
    try {
      const promoBlock = Boolean(
        data?.promoBlock ||
        data?.kind === 'PROMOTION' ||
        String(data?.blockType || '').toUpperCase() === 'PROMOTION',
      );
      const promoEnabled =
        data?.promoEnabled !== undefined ? Boolean(data.promoEnabled) : promoBlock;
      const promoPrice = this.parseDecimalInput(data?.promoPrice, 'promoPrice', {
        allowZero: false,
      });
      const promoOldPriceFromPayload = this.parseDecimalInput(data?.promoOldPrice, 'promoOldPrice');
      const promoEndsAt = this.parsePromoEndsAt(data?.promoEndsAt);

      let productPrice: Prisma.Decimal | null = null;
      const productIdFromBody =
        data?.productId !== undefined && data?.productId !== null && data?.productId !== ''
          ? Number(data.productId)
          : null;
      const promoVariant = await this.resolvePromotionVariant(
        productIdFromBody,
        data?.promoVariantKey,
      );
      if (productIdFromBody && Number.isFinite(productIdFromBody) && productIdFromBody > 0) {
        const product = await this.prisma.product.findUnique({
          where: { id: productIdFromBody },
          select: { price: true },
        });
        productPrice = product?.price ?? null;
      }

      const promoVariantPrice =
        promoVariant.price !== null && Number.isFinite(promoVariant.price)
          ? new Prisma.Decimal(promoVariant.price)
          : null;
      const fallbackOldPrice =
        this.parseDecimalInput(data?.priceOverride, 'priceOverride') ??
        promoVariantPrice ??
        productPrice;
      const promoOldPrice = promoOldPriceFromPayload ?? fallbackOldPrice;

      if (promoBlock && !productIdFromBody) {
        throw new BadRequestException('Для акционного блока нужно выбрать товар');
      }

      if (promoBlock && promoEnabled) {
        if (!promoPrice) {
          throw new BadRequestException('Для активной акции укажите новую цену');
        }
        if (!promoEndsAt) {
          throw new BadRequestException('Для активной акции укажите время окончания');
        }
        if (promoEndsAt.getTime() <= Date.now()) {
          throw new BadRequestException('Окончание акции должно быть в будущем');
        }
        if (promoOldPrice && promoPrice.greaterThanOrEqualTo(promoOldPrice)) {
          throw new BadRequestException('Акционная цена должна быть меньше старой');
        }
      }

      const payload: Prisma.ShopFeaturedItemCreateInput = {
        title: data.title,
        subtitle: data.subtitle || null,
        badge: promoBlock ? data.badge || 'Акция' : data.badge || null,
        position: Number(data.position || 0),
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        priceOverride: data.priceOverride ? new Prisma.Decimal(data.priceOverride) : undefined,
        promoBlock,
        promoEnabled: promoBlock ? promoEnabled : false,
        promoPrice: promoBlock ? (promoPrice ?? undefined) : null,
        promoOldPrice: promoBlock ? (promoOldPrice ?? undefined) : null,
        promoVariantKey: promoBlock ? promoVariant.key : null,
        promoVariantLabel: promoBlock ? promoVariant.label : null,
        promoEndsAt: promoBlock ? (promoEndsAt ?? undefined) : null,
      };

      if (data.kitId) {
        payload.kit = { connect: { id: Number(data.kitId) } };
      } else if (data.productId) {
        payload.product = { connect: { id: Number(data.productId) } };
      }

      return await this.prisma.shopFeaturedItem.create({ data: payload });
    } catch (error) {
      if (!this.isPromoColumnsMissing(error)) throw error;
      return this.createLegacy(data);
    }
  }

  async update(id: number, data: any) {
    try {
      const exists = await this.prisma.shopFeaturedItem.findUnique({ where: { id } });
      if (!exists) {
        throw new NotFoundException('Карточка не найдена');
      }

      const promoBlockIncoming =
        data?.promoBlock !== undefined
          ? Boolean(data.promoBlock)
          : data?.kind === 'PROMOTION' ||
            String(data?.blockType || '').toUpperCase() === 'PROMOTION' ||
            exists.promoBlock;

      const promoEnabledIncoming =
        data?.promoEnabled !== undefined ? Boolean(data.promoEnabled) : exists.promoEnabled;
      const promoPriceIncoming = this.parseDecimalInput(data?.promoPrice, 'promoPrice', {
        allowZero: false,
      });
      const promoOldPriceIncoming = this.parseDecimalInput(data?.promoOldPrice, 'promoOldPrice');
      const promoEndsAtIncoming = this.parsePromoEndsAt(data?.promoEndsAt);

      const selectedProductId =
        data?.productId !== undefined
          ? data.productId === null || data.productId === ''
            ? null
            : Number(data.productId)
          : exists.productId;
      const promoVariant = await this.resolvePromotionVariant(
        selectedProductId,
        data?.promoVariantKey,
      );
      let productPrice: Prisma.Decimal | null = null;
      if (selectedProductId && Number.isFinite(selectedProductId) && selectedProductId > 0) {
        const product = await this.prisma.product.findUnique({
          where: { id: selectedProductId },
          select: { price: true },
        });
        productPrice = product?.price ?? null;
      }

      const fallbackOldPrice =
        promoOldPriceIncoming ??
        this.parseDecimalInput(data?.priceOverride, 'priceOverride') ??
        (promoVariant.price !== null && Number.isFinite(promoVariant.price)
          ? new Prisma.Decimal(promoVariant.price)
          : null) ??
        exists.promoOldPrice ??
        exists.priceOverride ??
        productPrice;

      const resolvedPromoPrice =
        promoPriceIncoming !== undefined ? promoPriceIncoming : exists.promoPrice;
      const resolvedPromoEndsAt =
        promoEndsAtIncoming !== undefined ? promoEndsAtIncoming : exists.promoEndsAt;
      const resolvedPromoOldPrice = fallbackOldPrice ?? null;

      if (promoBlockIncoming && !selectedProductId) {
        throw new BadRequestException('Для акционного блока нужно выбрать товар');
      }

      if (promoBlockIncoming && promoEnabledIncoming) {
        if (!resolvedPromoPrice) {
          throw new BadRequestException('Для активной акции укажите новую цену');
        }
        if (!resolvedPromoEndsAt) {
          throw new BadRequestException('Для активной акции укажите время окончания');
        }
        if (new Date(resolvedPromoEndsAt).getTime() <= Date.now()) {
          throw new BadRequestException('Окончание акции должно быть в будущем');
        }
        if (
          resolvedPromoOldPrice &&
          resolvedPromoPrice.greaterThanOrEqualTo(resolvedPromoOldPrice)
        ) {
          throw new BadRequestException('Акционная цена должна быть меньше старой');
        }
      }

      const payload: Prisma.ShopFeaturedItemUpdateInput = {
        title: data.title ?? undefined,
        subtitle: data.subtitle ?? undefined,
        badge:
          data.badge !== undefined
            ? data.badge
            : promoBlockIncoming
              ? exists.badge || 'Акция'
              : undefined,
        position: data.position !== undefined ? Number(data.position) : undefined,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
        priceOverride:
          data.priceOverride !== undefined && data.priceOverride !== ''
            ? new Prisma.Decimal(data.priceOverride)
            : data.priceOverride === ''
              ? null
              : undefined,
        promoBlock: promoBlockIncoming,
        promoEnabled: promoBlockIncoming ? promoEnabledIncoming : false,
        promoPrice: !promoBlockIncoming
          ? null
          : data.promoPrice !== undefined
            ? promoPriceIncoming
            : undefined,
        promoOldPrice: !promoBlockIncoming
          ? null
          : data.promoOldPrice !== undefined || data.priceOverride !== undefined
            ? resolvedPromoOldPrice
            : undefined,
        promoVariantKey: !promoBlockIncoming
          ? null
          : data.promoVariantKey !== undefined || data.productId !== undefined
            ? promoVariant.key
            : undefined,
        promoVariantLabel: !promoBlockIncoming
          ? null
          : data.promoVariantKey !== undefined || data.productId !== undefined
            ? promoVariant.label
            : undefined,
        promoEndsAt: !promoBlockIncoming
          ? null
          : promoEndsAtIncoming !== undefined
            ? promoEndsAtIncoming
            : undefined,
      };

      if (data.kitId !== undefined) {
        if (data.kitId === null || data.kitId === '') {
          payload.kit = { disconnect: true };
        } else {
          payload.kit = { connect: { id: Number(data.kitId) } };
          payload.product = { disconnect: true };
        }
      }

      if (data.productId !== undefined) {
        if (data.productId === null || data.productId === '') {
          payload.product = { disconnect: true };
        } else {
          payload.product = { connect: { id: Number(data.productId) } };
          payload.kit = { disconnect: true };
        }
      }

      return await this.prisma.shopFeaturedItem.update({
        where: { id },
        data: payload,
      });
    } catch (error) {
      if (!this.isPromoColumnsMissing(error)) throw error;
      return this.updateLegacy(id, data);
    }
  }

  async remove(id: number) {
    return this.prisma.shopFeaturedItem.delete({ where: { id } });
  }
}
