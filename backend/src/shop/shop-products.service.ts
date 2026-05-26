import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { buildProductSlug } from '../products/product-slug.util';
import { InventoryService } from '../inventory/inventory.service';
import { ActiveStorePromotion, ShopFeaturedService } from './shop-featured.service';

@Injectable()
export class ShopProductsService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
    private featured: ShopFeaturedService,
  ) {}

  private readonly logger = new Logger(ShopProductsService.name);
  private readonly responseCache = new Map<string, { expiresAt: number; value: any }>();
  private slugBackfillPromise: Promise<void> | null = null;
  private availabilitySyncPromise: Promise<void> | null = null;
  private availabilitySynced = false;

  private readonly defaultStoreCategories = [
    { value: 'HOME_CONSOLES', label: 'Игровые приставки' },
    { value: 'PORTABLE_CONSOLES', label: 'Портативные приставки' },
    { value: 'GAME_DISKS', label: 'Игровые диски' },
    { value: 'DIGITAL_SERVICES', label: 'Цифровые сервисы' },
  ] as const;

  private normalizePublicAssetUrl(input?: string | null) {
    const raw = String(input || '').trim();
    if (!raw) return null;
    if (raw.startsWith('/assets/')) return raw;

    try {
      const parsed = new URL(raw);
      if (parsed.pathname.startsWith('/assets/')) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return raw;
    } catch {
      return raw;
    }
  }

  private normalizePublicAssetList(input: unknown) {
    if (!Array.isArray(input)) return [] as string[];
    return input
      .map(item => this.normalizePublicAssetUrl(String(item || '')))
      .filter((item): item is string => Boolean(item));
  }

  private resolveStoreCategory(product: {
    category?: string | null;
    storefrontCategory?: string | null;
  }) {
    if (product.storefrontCategory?.trim()) {
      return product.storefrontCategory.trim();
    }

    if (product.category === 'DISK') return 'GAME_DISKS';
    if (product.category === 'SERVICE' || product.category === 'SUBSCRIPTION_KEY') {
      return 'DIGITAL_SERVICES';
    }
    if (product.category === 'CONSOLE') {
      // Консоли на сайт выводим только как карточки каталога (storefrontCategory).
      // Складские позиции без storefrontCategory не должны попадать в каталог.
      return null;
    }
    return null;
  }

  private isPublicCatalogProduct(product: {
    category?: string | null;
    storefrontCategory?: string | null;
    stock?: number | null;
  }) {
    if (product.storefrontCategory?.trim()) {
      return true;
    }
    if (product.category === 'DISK') {
      return Number(product.stock || 0) > 0;
    }
    if (product.category === 'SERVICE' || product.category === 'SUBSCRIPTION_KEY') {
      return true;
    }
    return false;
  }

  private normalizeVariantKey(input?: string | null) {
    return String(input || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  private cacheGet<T>(key: string): T | null {
    const hit = this.responseCache.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) {
      this.responseCache.delete(key);
      return null;
    }
    return hit.value as T;
  }

  private cacheSet<T>(key: string, value: T, ttlMs: number) {
    this.responseCache.set(key, {
      expiresAt: Date.now() + Math.max(1000, ttlMs),
      value,
    });
  }

  private async ensureStorefrontAvailabilityConsistency() {
    if (this.availabilitySynced) return;
    if (this.availabilitySyncPromise) {
      await this.availabilitySyncPromise;
      return;
    }

    this.availabilitySyncPromise = (async () => {
      await this.prisma.product.updateMany({
        where: {
          tenant: 'TECHNOPRIME',
          isActive: false,
          archivedAt: { not: null },
          isArchived: false,
        },
        data: {
          isArchived: true,
        },
      });

      const storefrontProducts = await this.prisma.product.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          isActive: true,
          isArchived: false,
          storefrontCategory: { not: null },
        },
        select: { id: true },
        orderBy: { id: 'asc' },
      });

      for (const product of storefrontProducts) {
        // Rebuild persisted stock for storefront cards after archived warehouse items were backfilled.
        // This removes legacy "ghost stock" from public badges without requiring manual resave.

        await this.inventory.recalcProductAvailability(product.id);
      }

      this.availabilitySynced = true;
    })()
      .catch(error => {
        this.availabilitySyncPromise = null;
        throw error;
      })
      .finally(() => {
        this.availabilitySyncPromise = null;
      });

    await this.availabilitySyncPromise;
  }

  onModuleInit() {
    void this.ensureStorefrontAvailabilityConsistency().catch(error => {
      this.logger.error(
        'Storefront availability sync failed on startup',
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  private toPublicProduct(product: any, promo?: ActiveStorePromotion | null) {
    const normalizedCoverImage = this.normalizePublicAssetUrl(product?.coverImage);
    const normalizedPreviewImage = this.normalizePublicAssetUrl(product?.previewImage);
    const normalizedGallery = this.normalizePublicAssetList(product?.gallery);

    const variants = Array.isArray(product?.variants)
      ? product.variants
          .map((row: any) => {
            const key = String(row?.key || '').trim();
            const label = String(row?.label || key).trim();
            const memoryGbRaw = Number(row?.memoryGb ?? NaN);
            const memoryGb =
              Number.isFinite(memoryGbRaw) && memoryGbRaw > 0 ? Math.round(memoryGbRaw) : null;
            const price = Number(row?.price ?? 0);
            const costPriceRaw = Number(row?.costPrice ?? NaN);
            const costPrice =
              Number.isFinite(costPriceRaw) && costPriceRaw >= 0 ? costPriceRaw : null;
            const stock = Math.max(0, Math.floor(Number(row?.stock ?? 0)));
            const inStock = row?.inStock !== undefined ? Boolean(row.inStock) : stock > 0;
            const isDefault = Boolean(row?.isDefault);

            if (!key || !label || !Number.isFinite(price) || price < 0) return null;
            return {
              key,
              label,
              memoryGb,
              price,
              costPrice,
              stock,
              inStock,
              isDefault,
              originalPrice: null as number | null,
              promoPrice: null as number | null,
              promoOldPrice: null as number | null,
              promoEndsAt: null as string | null,
              promoRemainingSec: 0,
              isPromo: false,
            };
          })
          .filter(Boolean)
      : [];

    const hasVariants = variants.length > 0;
    const defaultVariant = hasVariants
      ? variants.find((variant: any) => Boolean(variant?.isDefault)) || variants[0]
      : null;
    const normalizedPromoVariantKey =
      this.normalizeVariantKey(promo?.promoVariantKey || '') || null;
    const effectivePromoVariantKey =
      promo && hasVariants ? normalizedPromoVariantKey || defaultVariant?.key || null : null;
    const activePromo =
      promo && Number.isFinite(Number(promo.promoPrice)) && Number(promo.promoPrice) > 0
        ? promo
        : null;

    const nextVariants = hasVariants
      ? variants.map((variant: any) => {
          const applies =
            Boolean(activePromo) &&
            effectivePromoVariantKey !== null &&
            variant.key === effectivePromoVariantKey;
          if (!applies) return variant;

          const oldPriceSource = Number(activePromo?.promoOldPrice || variant.price || 0);
          const newPrice = Number(activePromo?.promoPrice || variant.price || 0);
          return {
            ...variant,
            price: newPrice,
            originalPrice: oldPriceSource > newPrice ? oldPriceSource : Number(variant.price || 0),
            promoPrice: newPrice,
            promoOldPrice: oldPriceSource > 0 ? oldPriceSource : Number(variant.price || 0),
            promoEndsAt: activePromo?.promoEndsAt || null,
            promoRemainingSec: Number(activePromo?.promoRemainingSec || 0),
            isPromo: true,
          };
        })
      : variants;

    const variantInStock = hasVariants
      ? nextVariants.some((variant: any) => Boolean(variant?.inStock))
      : false;
    const variantTotalStock = hasVariants
      ? nextVariants.reduce((sum: number, variant: any) => sum + Number(variant?.stock || 0), 0)
      : 0;

    const inStock = product.isAlwaysAvailable
      ? true
      : hasVariants
        ? variantInStock
        : Boolean(product.inStock) || Number(product.stock || 0) > 0;

    const defaultVariantState =
      defaultVariant && hasVariants
        ? nextVariants.find((variant: any) => variant.key === defaultVariant.key) || defaultVariant
        : null;
    const topLevelPrice = hasVariants
      ? Number(defaultVariantState?.price ?? product.price ?? 0)
      : activePromo
        ? Number(activePromo.promoPrice || product.price || 0)
        : Number(product.price || 0);
    const topLevelOldPrice = hasVariants
      ? Number(defaultVariantState?.promoOldPrice || 0) || null
      : activePromo
        ? Number(activePromo.promoOldPrice || product.price || 0)
        : null;
    const topLevelPromo = hasVariants
      ? Boolean(defaultVariantState?.isPromo)
      : Boolean(activePromo);

    return {
      ...product,
      coverImage: normalizedCoverImage,
      previewImage: normalizedPreviewImage,
      gallery: normalizedGallery,
      price: topLevelPrice,
      originalPrice:
        topLevelPromo && topLevelOldPrice && topLevelOldPrice > topLevelPrice
          ? topLevelOldPrice
          : null,
      promoPrice: topLevelPromo ? topLevelPrice : null,
      promoOldPrice:
        topLevelPromo && topLevelOldPrice && topLevelOldPrice > topLevelPrice
          ? topLevelOldPrice
          : null,
      promoEndsAt: topLevelPromo
        ? hasVariants
          ? defaultVariantState?.promoEndsAt || null
          : activePromo?.promoEndsAt || null
        : null,
      promoRemainingSec: topLevelPromo
        ? Number(
            hasVariants
              ? defaultVariantState?.promoRemainingSec || 0
              : activePromo?.promoRemainingSec || 0,
          )
        : 0,
      isPromo: topLevelPromo,
      promoVariantKey: activePromo?.promoVariantKey || null,
      promoVariantLabel: activePromo?.promoVariantLabel || null,
      variants: nextVariants.length > 0 ? nextVariants : null,
      stock: nextVariants.length > 0 ? variantTotalStock : product.stock,
      inStock,
      storeCategory: this.resolveStoreCategory(product),
    };
  }

  private normalizeCookieId(raw?: string | null) {
    const value = String(raw || '').trim();
    if (!value) return null;
    return value.slice(0, 120);
  }

  private async makeUniqueSlug(
    baseInput: {
      id?: number | string | null;
      slug?: string | null;
      name?: string | null;
      brand?: string | null;
      model?: string | null;
      version?: string | null;
      adSku?: string | null;
    },
    skipProductId?: number,
  ) {
    const baseSlug = buildProductSlug(baseInput);
    let candidate = baseSlug;
    let suffix = 2;

    while (true) {
      const existing = await this.prisma.product.findFirst({
        where: {
          slug: candidate,
          ...(skipProductId ? { id: { not: skipProductId } } : {}),
        },
        select: { id: true },
      });

      if (!existing) return candidate;

      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
  }

  private async ensurePublicProductSlugs() {
    if (this.slugBackfillPromise) return this.slugBackfillPromise;

    this.slugBackfillPromise = (async () => {
      const products = await this.prisma.product.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          isActive: true,
          isArchived: false,
          storefrontCategory: { not: null },
          OR: [{ slug: null }, { slug: '' }],
        },
        orderBy: { id: 'asc' },
        take: 200,
        select: {
          id: true,
          slug: true,
          name: true,
          brand: true,
          model: true,
          version: true,
          adSku: true,
        },
      });

      for (const product of products) {
        const slug = await this.makeUniqueSlug(product, product.id);
        await this.prisma.product.update({
          where: { id: product.id },
          data: { slug },
        });
      }
    })()
      .catch(error => {
        this.slugBackfillPromise = null;
        throw error;
      })
      .finally(() => {
        this.slugBackfillPromise = null;
      });

    return this.slugBackfillPromise;
  }

  async trackView(input: { productId?: number; cookieId?: string | null }) {
    const productId = Number(input.productId || 0);
    if (!productId || Number.isNaN(productId)) {
      throw new BadRequestException('productId is required');
    }

    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        tenant: 'TECHNOPRIME',
        isActive: true,
        isArchived: false,
      },
      select: {
        id: true,
        category: true,
        storefrontCategory: true,
        stock: true,
      },
    });

    if (!product || !this.isPublicCatalogProduct(product)) {
      throw new BadRequestException('Товар недоступен для витрины');
    }

    await this.prisma.productViewEvent.create({
      data: {
        tenant: 'TECHNOPRIME',
        productId,
        cookieId: this.normalizeCookieId(input.cookieId),
      },
    });

    return { success: true };
  }

  async listTopViewed(query?: { limit?: number; days?: number }) {
    await this.ensurePublicProductSlugs();
    await this.ensureStorefrontAvailabilityConsistency();

    const limit = Math.max(1, Math.min(Number(query?.limit || 3), 12));
    const days = Math.max(1, Math.min(Number(query?.days || 30), 90));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const grouped = await this.prisma.productViewEvent.groupBy({
      by: ['productId'],
      where: {
        tenant: 'TECHNOPRIME',
        viewedAt: { gte: since },
      },
      _count: { productId: true },
      orderBy: {
        _count: {
          productId: 'desc',
        },
      },
      take: limit,
    });

    if (!grouped.length) {
      return {
        items: [],
        total: 0,
      };
    }

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: grouped.map(row => row.productId) },
        tenant: 'TECHNOPRIME',
        isActive: true,
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        category: true,
        condition: true,
        brand: true,
        model: true,
        version: true,
        slug: true,
        shortDescription: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
        coverImage: true,
        previewImage: true,
        gallery: true,
        price: true,
        costPrice: true,
        stock: true,
        inStock: true,
        isAlwaysAvailable: true,
        storefrontCategory: true,
        catalogMainKey: true,
        catalogSubKey: true,
        catalogFamilyKey: true,
        variants: true,
        adSku: true,
      },
    });

    const promotions = await this.featured.getActivePromotionMap(products.map(item => item.id));
    const productById = new Map(products.map(item => [item.id, item]));
    const items = grouped
      .map(row => {
        const product = productById.get(row.productId);
        if (!product || !this.isPublicCatalogProduct(product)) return null;
        return {
          ...this.toPublicProduct(product, promotions.get(product.id)),
          viewCount: row._count?.productId || 0,
        };
      })
      .filter(Boolean);

    return {
      items,
      total: items.length,
    };
  }

  async listPublic(query?: any) {
    await this.ensurePublicProductSlugs();
    await this.ensureStorefrontAvailabilityConsistency();

    const cacheKey = JSON.stringify({
      scope: 'listPublic',
      q: String(query?.q || '')
        .trim()
        .toLowerCase(),
      category: String(query?.category || '')
        .trim()
        .toLowerCase(),
      storeCategory: String(query?.storeCategory || '')
        .trim()
        .toLowerCase(),
      limit: Number(query?.limit || 300),
    });
    const cached = this.cacheGet<{ items: any[]; total: number; success: boolean }>(cacheKey);
    if (cached) {
      return cached;
    }

    const publicCatalogPredicate: Prisma.ProductWhereInput = {
      OR: [
        { storefrontCategory: { not: null } },
        {
          category: 'DISK',
          stock: { gt: 0 },
        },
        { category: 'SERVICE' },
        { category: 'SUBSCRIPTION_KEY' },
      ],
    };

    const andConditions: Prisma.ProductWhereInput[] = [publicCatalogPredicate];

    if (query?.q) {
      andConditions.push({
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { brand: { contains: query.q, mode: 'insensitive' } },
          { model: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.ProductWhereInput = {
      tenant: 'TECHNOPRIME',
      isActive: true,
      isArchived: false,
      AND: andConditions,
    };

    const limit = query?.limit ? Math.min(Number(query.limit), 500) : 300;

    const rawItems = await this.prisma.product.findMany({
      where,
      take: limit,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        name: true,
        category: true,
        condition: true,
        brand: true,
        model: true,
        version: true,
        slug: true,
        shortDescription: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
        coverImage: true,
        previewImage: true,
        gallery: true,
        price: true,
        costPrice: true,
        stock: true,
        inStock: true,
        isAlwaysAvailable: true,
        storefrontCategory: true,
        catalogMainKey: true,
        catalogSubKey: true,
        catalogFamilyKey: true,
        variants: true,
        adSku: true,
      },
    });

    const promotions = await this.featured.getActivePromotionMap(rawItems.map(row => row.id));
    let items = rawItems
      .filter(row => this.isPublicCatalogProduct(row))
      .map(row => this.toPublicProduct(row, promotions.get(row.id)));

    if (query?.category && query.category !== 'all') {
      items = items.filter(row => row.category === query.category);
    }

    if (query?.storeCategory && query.storeCategory !== 'all') {
      items = items.filter(row => row.storeCategory === query.storeCategory);
    }

    // Диски на сайте показываем только из реального наличия.
    if (String(query?.storeCategory || '') === 'GAME_DISKS') {
      items = items.filter(row => Number(row.stock || 0) > 0);
    }

    const response = {
      items,
      total: items.length,
      success: true,
    };

    this.cacheSet(cacheKey, response, 20_000);
    return response;
  }

  async listStoreCategories() {
    const cacheKey = 'listStoreCategories';
    const cached =
      this.cacheGet<Array<{ value: string; label: string; count: number; isDefault: boolean }>>(
        cacheKey,
      );
    if (cached) {
      return cached;
    }

    await this.ensureStorefrontAvailabilityConsistency();
    const products = await this.prisma.product.findMany({
      where: {
        tenant: 'TECHNOPRIME',
        isActive: true,
        isArchived: false,
      },
      select: {
        id: true,
        category: true,
        adSku: true,
        storefrontCategory: true,
      },
    });

    const counters = new Map<string, number>();
    for (const row of products) {
      const key = this.resolveStoreCategory(row);
      if (!key) continue;
      counters.set(key, (counters.get(key) || 0) + 1);
    }

    const defaults = this.defaultStoreCategories.map(item => ({
      value: item.value,
      label: item.label,
      count: counters.get(item.value) || 0,
      isDefault: true,
    }));

    const defaultValues = new Set<string>(defaults.map(x => x.value));
    const custom = Array.from(counters.entries())
      .filter(([value]) => !defaultValues.has(value))
      .map(([value, count]) => ({
        value,
        label: value,
        count,
        isDefault: false,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'));

    const response = [...defaults, ...custom];
    this.cacheSet(cacheKey, response, 60_000);
    return response;
  }

  async findOnePublic(id: number) {
    await this.ensurePublicProductSlugs();
    await this.ensureStorefrontAvailabilityConsistency();

    const product = await this.prisma.product.findFirst({
      where: {
        id,
        tenant: 'TECHNOPRIME',
        isActive: true,
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        category: true,
        condition: true,
        brand: true,
        model: true,
        version: true,
        slug: true,
        shortDescription: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
        coverImage: true,
        previewImage: true,
        gallery: true,
        price: true,
        costPrice: true,
        stock: true,
        inStock: true,
        isAlwaysAvailable: true,
        storefrontCategory: true,
        catalogMainKey: true,
        catalogSubKey: true,
        catalogFamilyKey: true,
        variants: true,
        adSku: true,
      },
    });

    if (!product) return null;
    const promotions = await this.featured.getActivePromotionMap([product.id]);
    return this.toPublicProduct(product, promotions.get(product.id));
  }

  async findBySlugPublic(slug: string) {
    await this.ensurePublicProductSlugs();
    await this.ensureStorefrontAvailabilityConsistency();

    const asId = Number(slug);
    if (!Number.isNaN(asId) && asId > 0) {
      return this.findOnePublic(asId);
    }

    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        tenant: 'TECHNOPRIME',
        isActive: true,
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        category: true,
        condition: true,
        brand: true,
        model: true,
        version: true,
        slug: true,
        shortDescription: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
        coverImage: true,
        previewImage: true,
        gallery: true,
        price: true,
        costPrice: true,
        stock: true,
        inStock: true,
        isAlwaysAvailable: true,
        storefrontCategory: true,
        catalogMainKey: true,
        catalogSubKey: true,
        catalogFamilyKey: true,
        variants: true,
        adSku: true,
      },
    });

    if (!product) return null;
    const promotions = await this.featured.getActivePromotionMap([product.id]);
    return this.toPublicProduct(product, promotions.get(product.id));
  }
}
