import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma, InventoryUnitStatus, Role } from '@prisma/client';
import { promises as fs } from 'fs';
import { join } from 'path';
import { InventoryService } from '../inventory/inventory.service';
import { buildProductSlug } from './product-slug.util';

type CatalogSeedItem = {
  name: string;
  slug?: string;
  storefrontCategory: 'HOME_CONSOLES' | 'PORTABLE_CONSOLES';
  catalogMainKey: string;
  catalogSubKey: string;
  catalogFamilyKey: string;
  brand: string;
  model: string;
  version: string;
  condition: 'NEW' | 'USED';
  price: number;
  shortDescription: string;
  description: string;
  seoTitle?: string;
  seoDescription?: string;
  forceSyncContent?: boolean;
  variants?: ProductVariantInput[];
};

type ProductVariantInput = {
  key: string;
  label: string;
  memoryGb?: number | null;
  price: number;
  costPrice?: number | null;
  stock?: number;
  isDefault?: boolean;
};

type ProductVariantNormalized = {
  key: string;
  label: string;
  memoryGb: number | null;
  price: number;
  costPrice: number | null;
  stock: number;
  inStock: boolean;
  isDefault: boolean;
};

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
  ) {}

  private seedPromise: Promise<void> | null = null;

  private readonly defaultStorefrontCategories = [
    'HOME_CONSOLES',
    'PORTABLE_CONSOLES',
    'GAME_DISKS',
    'DIGITAL_SERVICES',
  ] as const;

  private readonly catalogSeed: CatalogSeedItem[] = [
    {
      name: 'PlayStation 4 FAT',
      slug: 'playstation-4-fat',
      storefrontCategory: 'HOME_CONSOLES',
      catalogMainKey: 'home-consoles',
      catalogSubKey: 'playstation',
      catalogFamilyKey: 'ps4',
      brand: 'Sony',
      model: 'PlayStation 4 FAT',
      version: '512GB / 1024GB',
      condition: 'USED',
      price: 24990,
      shortDescription: 'Комплект: консоль, геймпад, HDMI и кабель питания.',
      description: 'Классическая ревизия PS4. Подходит для цифровой библиотеки и дисковых игр.',
      seoTitle: 'PlayStation 4 FAT купить в Москве | TechnoPrime',
      seoDescription:
        'PlayStation 4 FAT в каталоге TechnoPrime: проверка перед продажей, понятная комплектация и быстрая доставка.',
      variants: [
        {
          key: '512gb',
          label: '512 GB',
          memoryGb: 512,
          price: 24990,
          costPrice: 18743,
          stock: 0,
          isDefault: true,
        },
        {
          key: '1024gb',
          label: '1024 GB',
          memoryGb: 1024,
          price: 27990,
          costPrice: 20993,
          stock: 0,
        },
      ],
    },
    {
      name: 'PlayStation 4 Slim',
      slug: 'playstation-4-slim',
      storefrontCategory: 'HOME_CONSOLES',
      catalogMainKey: 'home-consoles',
      catalogSubKey: 'playstation',
      catalogFamilyKey: 'ps4',
      brand: 'Sony',
      model: 'PlayStation 4 Slim',
      version: '512GB / 1024GB',
      condition: 'USED',
      price: 29990,
      shortDescription: 'Комплект: консоль, геймпад, HDMI и кабель питания.',
      description: 'Компактная ревизия PS4 Slim для домашнего гейминга.',
      seoTitle: 'PlayStation 4 Slim купить в Москве | TechnoPrime',
      seoDescription:
        'PlayStation 4 Slim в каталоге TechnoPrime: компактная ревизия PS4, проверка перед продажей и честная цена.',
      variants: [
        {
          key: '512gb',
          label: '512 GB',
          memoryGb: 512,
          price: 29990,
          costPrice: 22493,
          stock: 0,
          isDefault: true,
        },
        {
          key: '1024gb',
          label: '1024 GB',
          memoryGb: 1024,
          price: 32990,
          costPrice: 24743,
          stock: 0,
        },
      ],
    },
    {
      name: 'PlayStation 4 Pro',
      slug: 'playstation-4-pro',
      storefrontCategory: 'HOME_CONSOLES',
      catalogMainKey: 'home-consoles',
      catalogSubKey: 'playstation',
      catalogFamilyKey: 'ps4',
      brand: 'Sony',
      model: 'PlayStation 4 Pro',
      version: '1000GB',
      condition: 'USED',
      price: 37990,
      shortDescription:
        'Комплект: PlayStation 4 Pro; 2 оригинальных геймпада; зарядная док-станция для геймпадов; подписка PlayStation Plus Deluxe; сервис отслеживания подписки и продления; кабели HDMI, питание, micro-USB; гарантия 14 дней.',
      description:
        'Игровая приставка PlayStation 4 Pro в отличном состоянии с двумя оригинальными геймпадами, зарядной док-станцией, полностью готовая к игре под ключ: система настроена и проверена, подключена подписка PlayStation Plus Deluxe с доступом к библиотеке игр, а также включен сервис отслеживания и продления подписки. В комплекте все необходимые кабели: HDMI, питание и micro-USB, плюс гарантия 14 дней для вашей уверенности. Доступ к играм предоставляется в рамках подписки. Состав и доступность игр могут изменяться в зависимости от региона и политики сервиса. Возможны незначительные следы использования.',
      seoTitle: 'PlayStation 4 Pro 1000GB купить в Москве | TechnoPrime',
      seoDescription:
        'PlayStation 4 Pro 1000GB в отличном состоянии: 2 оригинальных геймпада, док-станция, PS Plus Deluxe, кабели и гарантия 14 дней.',
      forceSyncContent: true,
      variants: [
        {
          key: '1000gb',
          label: '1000 GB',
          memoryGb: 1000,
          price: 37990,
          costPrice: 28493,
          stock: 0,
          isDefault: true,
        },
      ],
    },
    {
      name: 'Sony PlayStation 5 FAT Digital',
      storefrontCategory: 'HOME_CONSOLES',
      catalogMainKey: 'home-consoles',
      catalogSubKey: 'playstation',
      catalogFamilyKey: 'ps5',
      brand: 'Sony',
      model: 'Sony PlayStation 5 FAT',
      version: 'Digital Edition',
      condition: 'USED',
      price: 52990,
      shortDescription: 'Комплект: консоль, DualSense, HDMI, кабель питания.',
      description: 'PS5 FAT Digital Edition без дисковода.',
    },
    {
      name: 'Sony PlayStation 5 FAT Blu-Ray',
      storefrontCategory: 'HOME_CONSOLES',
      catalogMainKey: 'home-consoles',
      catalogSubKey: 'playstation',
      catalogFamilyKey: 'ps5',
      brand: 'Sony',
      model: 'Sony PlayStation 5 FAT',
      version: 'Blu-Ray Edition',
      condition: 'USED',
      price: 55990,
      shortDescription: 'Комплект: консоль, DualSense, HDMI, кабель питания.',
      description: 'PS5 FAT Blu-Ray Edition с дисководом.',
    },
    {
      name: 'Sony PlayStation 5 Slim Digital',
      storefrontCategory: 'HOME_CONSOLES',
      catalogMainKey: 'home-consoles',
      catalogSubKey: 'playstation',
      catalogFamilyKey: 'ps5',
      brand: 'Sony',
      model: 'Sony PlayStation 5 Slim',
      version: 'Digital Edition',
      condition: 'USED',
      price: 58990,
      shortDescription: 'Комплект: консоль, DualSense, HDMI, кабель питания.',
      description: 'PS5 Slim Digital Edition без дисковода.',
    },
    {
      name: 'Sony PlayStation 5 Slim Blu-Ray',
      storefrontCategory: 'HOME_CONSOLES',
      catalogMainKey: 'home-consoles',
      catalogSubKey: 'playstation',
      catalogFamilyKey: 'ps5',
      brand: 'Sony',
      model: 'Sony PlayStation 5 Slim',
      version: 'Blu-Ray Edition',
      condition: 'USED',
      price: 61990,
      shortDescription: 'Комплект: консоль, DualSense, HDMI, кабель питания.',
      description: 'PS5 Slim Blu-Ray Edition с дисководом.',
    },
    {
      name: 'Xbox One S',
      storefrontCategory: 'HOME_CONSOLES',
      catalogMainKey: 'home-consoles',
      catalogSubKey: 'xbox',
      catalogFamilyKey: 'xbox-one',
      brand: 'Microsoft',
      model: 'Xbox One S',
      version: '512GB / 1024GB',
      condition: 'USED',
      price: 24990,
      shortDescription: 'Комплект: консоль, геймпад, HDMI, кабель питания.',
      description: 'Домашняя консоль Xbox One S.',
      variants: [
        {
          key: '512gb',
          label: '512 GB',
          memoryGb: 512,
          price: 24990,
          costPrice: 18743,
          stock: 0,
          isDefault: true,
        },
        {
          key: '1024gb',
          label: '1024 GB',
          memoryGb: 1024,
          price: 27990,
          costPrice: 20993,
          stock: 0,
        },
      ],
    },
    {
      name: 'Xbox One X',
      storefrontCategory: 'HOME_CONSOLES',
      catalogMainKey: 'home-consoles',
      catalogSubKey: 'xbox',
      catalogFamilyKey: 'xbox-one',
      brand: 'Microsoft',
      model: 'Xbox One X',
      version: 'Standard',
      condition: 'USED',
      price: 31990,
      shortDescription: 'Комплект: консоль, геймпад, HDMI, кабель питания.',
      description: 'Производительная ревизия Xbox One X.',
    },
    {
      name: 'Xbox Series S',
      storefrontCategory: 'HOME_CONSOLES',
      catalogMainKey: 'home-consoles',
      catalogSubKey: 'xbox',
      catalogFamilyKey: 'xbox-series',
      brand: 'Microsoft',
      model: 'Xbox Series S',
      version: 'Standard',
      condition: 'USED',
      price: 35990,
      shortDescription: 'Комплект: консоль, геймпад, HDMI, кабель питания.',
      description: 'Современная домашняя консоль Xbox Series S.',
    },
    {
      name: 'Xbox Series X',
      storefrontCategory: 'HOME_CONSOLES',
      catalogMainKey: 'home-consoles',
      catalogSubKey: 'xbox',
      catalogFamilyKey: 'xbox-series',
      brand: 'Microsoft',
      model: 'Xbox Series X',
      version: 'Standard',
      condition: 'USED',
      price: 54990,
      shortDescription: 'Комплект: консоль, геймпад, HDMI, кабель питания.',
      description: 'Флагманская домашняя консоль Xbox Series X.',
    },
    {
      name: 'PlayStation Portal',
      storefrontCategory: 'PORTABLE_CONSOLES',
      catalogMainKey: 'portable-consoles',
      catalogSubKey: 'portable-playstation',
      catalogFamilyKey: 'playstation-portal',
      brand: 'Sony',
      model: 'PlayStation Portal',
      version: 'Standard',
      condition: 'USED',
      price: 26990,
      shortDescription: 'Комплект: устройство, USB-C кабель, документация.',
      description: 'Портативное устройство PlayStation Portal.',
    },
    {
      name: 'Steam Deck LCD',
      storefrontCategory: 'PORTABLE_CONSOLES',
      catalogMainKey: 'portable-consoles',
      catalogSubKey: 'steam-deck',
      catalogFamilyKey: 'steam-deck-lcd',
      brand: 'Valve',
      model: 'Steam Deck LCD',
      version: '512GB / 1024GB',
      condition: 'USED',
      price: 49990,
      shortDescription: 'Комплект: устройство, зарядка, кейс.',
      description: 'Steam Deck LCD с вариантами объема памяти 512GB и 1024GB.',
      variants: [
        {
          key: '512gb',
          label: '512 GB',
          memoryGb: 512,
          price: 49990,
          costPrice: 37493,
          stock: 0,
          isDefault: true,
        },
        {
          key: '1024gb',
          label: '1024 GB',
          memoryGb: 1024,
          price: 56990,
          costPrice: 42743,
          stock: 0,
        },
      ],
    },
    {
      name: 'Steam Deck OLED',
      storefrontCategory: 'PORTABLE_CONSOLES',
      catalogMainKey: 'portable-consoles',
      catalogSubKey: 'steam-deck',
      catalogFamilyKey: 'steam-deck-oled',
      brand: 'Valve',
      model: 'Steam Deck OLED',
      version: '512GB / 1024GB',
      condition: 'USED',
      price: 59990,
      shortDescription: 'Комплект: устройство, зарядка, кейс.',
      description: 'Steam Deck OLED с вариантами объема памяти 512GB и 1024GB.',
      variants: [
        {
          key: '512gb',
          label: '512 GB',
          memoryGb: 512,
          price: 59990,
          costPrice: 44993,
          stock: 0,
          isDefault: true,
        },
        {
          key: '1024gb',
          label: '1024 GB',
          memoryGb: 1024,
          price: 66990,
          costPrice: 50243,
          stock: 0,
        },
      ],
    },
    {
      name: 'Nintendo Switch Lite',
      storefrontCategory: 'PORTABLE_CONSOLES',
      catalogMainKey: 'portable-consoles',
      catalogSubKey: 'nintendo-switch',
      catalogFamilyKey: 'switch-lite',
      brand: 'Nintendo',
      model: 'Nintendo Switch Lite',
      version: 'Standard',
      condition: 'USED',
      price: 21990,
      shortDescription: 'Комплект: устройство, зарядка, документация.',
      description: 'Портативная консоль Nintendo Switch Lite.',
    },
    {
      name: 'Nintendo Switch 2',
      storefrontCategory: 'PORTABLE_CONSOLES',
      catalogMainKey: 'portable-consoles',
      catalogSubKey: 'nintendo-switch',
      catalogFamilyKey: 'switch-2',
      brand: 'Nintendo',
      model: 'Nintendo Switch 2',
      version: 'Standard',
      condition: 'USED',
      price: 42990,
      shortDescription: 'Комплект: устройство, зарядка, документация.',
      description: 'Портативная консоль Nintendo Switch 2.',
    },
  ];

  private async ensureBaseCatalogProducts() {
    if (this.seedPromise) return this.seedPromise;

    this.seedPromise = (async () => {
      for (const seed of this.catalogSeed) {
        const exists = await this.prisma.product.findFirst({
          where: {
            tenant: 'TECHNOPRIME',
            name: seed.name,
            storefrontCategory: seed.storefrontCategory,
          },
          select: {
            id: true,
            brand: true,
            model: true,
            version: true,
            condition: true,
            shortDescription: true,
            description: true,
            slug: true,
            seoTitle: true,
            seoDescription: true,
            price: true,
            costPrice: true,
            stock: true,
            inStock: true,
            catalogMainKey: true,
            catalogSubKey: true,
            catalogFamilyKey: true,
            variants: true,
          },
        });

        const seoTitle =
          this.sanitizeText(seed.seoTitle, 200) ||
          this.buildDefaultSeoTitle({
            name: seed.name,
            brand: seed.brand,
            model: seed.model,
            version: seed.version,
          });
        const seoDescription =
          this.sanitizeText(seed.seoDescription, 320) ||
          this.buildDefaultSeoDescription({
            name: seed.name,
            shortDescription: seed.shortDescription,
            description: seed.description,
          });
        const normalizedSeedVariants = this.normalizeVariants(seed.variants || []);
        const seedStock = normalizedSeedVariants ? this.sumVariantStock(normalizedSeedVariants) : 0;
        const seedInStock = normalizedSeedVariants
          ? normalizedSeedVariants.some(v => v.inStock)
          : false;

        if (!exists) {
          const costPrice = Math.max(0, Math.round(seed.price * 0.75));
          const slug = await this.makeUniqueSlug({
            name: seed.name,
            slug: seed.slug,
            brand: seed.brand,
            model: seed.model,
            version: seed.version,
          });
          await this.prisma.product.create({
            data: {
              tenant: 'TECHNOPRIME',
              name: seed.name,
              slug,
              category: 'CONSOLE',
              storefrontCategory: seed.storefrontCategory,
              catalogMainKey: this.sanitizeCatalogKey(seed.catalogMainKey),
              catalogSubKey: this.sanitizeCatalogKey(seed.catalogSubKey),
              catalogFamilyKey: this.sanitizeCatalogKey(seed.catalogFamilyKey),
              brand: seed.brand,
              model: seed.model,
              version: seed.version,
              condition: seed.condition,
              shortDescription: seed.shortDescription,
              description: seed.description,
              seoTitle,
              seoDescription,
              variants: normalizedSeedVariants as any,
              stock: seedStock,
              inStock: seedInStock,
              isActive: true,
              isArchived: false,
              isAlwaysAvailable: false,
              price: seed.price,
              costPrice,
            },
          });
          continue;
        }

        const patch: Prisma.ProductUpdateInput = {};
        if (!exists.slug) {
          patch.slug = await this.makeUniqueSlug(
            {
              id: exists.id,
              name: seed.name,
              slug: seed.slug,
              brand: seed.brand,
              model: seed.model,
              version: seed.version,
            },
            exists.id,
          );
        }
        if (!exists.brand) patch.brand = seed.brand;
        if (!exists.model) patch.model = seed.model;
        if (!exists.version) patch.version = seed.version;
        if (!exists.condition) patch.condition = seed.condition;
        if (!exists.shortDescription) patch.shortDescription = seed.shortDescription;
        if (!exists.description) patch.description = seed.description;
        if (!exists.seoTitle) patch.seoTitle = seoTitle;
        if (!exists.seoDescription) patch.seoDescription = seoDescription;
        if (!exists.catalogMainKey)
          patch.catalogMainKey = this.sanitizeCatalogKey(seed.catalogMainKey);
        if (!exists.catalogSubKey)
          patch.catalogSubKey = this.sanitizeCatalogKey(seed.catalogSubKey);
        if (!exists.catalogFamilyKey)
          patch.catalogFamilyKey = this.sanitizeCatalogKey(seed.catalogFamilyKey);
        if (!exists.variants && seed.variants?.length) {
          if (normalizedSeedVariants) {
            patch.variants = normalizedSeedVariants as any;
          }
        }
        const shouldForceSyncContent =
          Boolean(seed.forceSyncContent) &&
          (!exists.slug ||
            !exists.seoTitle ||
            !exists.seoDescription ||
            exists.version === '512GB / 1024GB');

        if (shouldForceSyncContent) {
          patch.slug = await this.makeUniqueSlug(
            {
              id: exists.id,
              name: seed.name,
              slug: seed.slug,
              brand: seed.brand,
              model: seed.model,
              version: seed.version,
            },
            exists.id,
          );
          patch.version = seed.version;
          patch.shortDescription = seed.shortDescription;
          patch.description = seed.description;
          patch.seoTitle = seoTitle;
          patch.seoDescription = seoDescription;
          patch.price = seed.price;
          patch.costPrice = Math.max(0, Math.round(seed.price * 0.75));
          patch.variants = normalizedSeedVariants as any;
          patch.stock = seedStock;
          patch.inStock = seedInStock;
          patch.catalogMainKey = this.sanitizeCatalogKey(seed.catalogMainKey);
          patch.catalogSubKey = this.sanitizeCatalogKey(seed.catalogSubKey);
          patch.catalogFamilyKey = this.sanitizeCatalogKey(seed.catalogFamilyKey);
        }

        if (Object.keys(patch).length > 0) {
          await this.prisma.product.update({
            where: { id: exists.id },
            data: patch,
          });
        }
      }

      // Legacy combined PS5 cards are hidden from storefront catalog in favor of 4 split variants.
      await this.prisma.product.updateMany({
        where: {
          tenant: 'TECHNOPRIME',
          storefrontCategory: 'HOME_CONSOLES',
          name: { in: ['PlayStation 5 FAT', 'PlayStation 5 Slim'] },
          version: { contains: 'Digital / Blu-ray', mode: 'insensitive' },
        },
        data: {
          storefrontCategory: null,
        },
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

  private assetsDirForProduct(productId: number) {
    return join(process.cwd(), '..', 'assets', 'shop', 'products', String(productId));
  }

  private normalizeGallery(input: unknown): string[] {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.filter(item => typeof item === 'string' && item.trim()) as string[];
    }
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => typeof item === 'string' && item.trim()) as string[];
        }
      } catch {
        return input.trim() ? [input.trim()] : [];
      }
    }
    return [];
  }

  private sanitizeStorefrontCategory(value: any): string | null {
    const normalized = String(value ?? '').trim();
    if (!normalized) return null;
    return normalized.slice(0, 64);
  }

  private sanitizeCatalogKey(value: any): string | null {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    if (!normalized) return null;
    return normalized.slice(0, 64);
  }

  private sanitizeText(value: unknown, maxLength = 4000): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return null;
    return normalized.slice(0, maxLength);
  }

  private buildDefaultSeoTitle(input: {
    name?: string | null;
    brand?: string | null;
    model?: string | null;
    version?: string | null;
  }) {
    const rawTitle = [input.name, input.brand, input.model, input.version]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const title = rawTitle || 'Игровая приставка';
    return `${title} купить в Москве | TechnoPrime`.slice(0, 200);
  }

  private buildDefaultSeoDescription(input: {
    name?: string | null;
    shortDescription?: string | null;
    description?: string | null;
  }) {
    const intro =
      this.sanitizeText(input.shortDescription, 180) || this.sanitizeText(input.description, 180);
    const base = input.name ? `${input.name}.` : 'Товар TechnoPrime.';
    const tail = intro
      ? ` ${intro}`
      : ' Проверка, честная цена, гарантия и быстрая доставка от TechnoPrime.';
    return `${base}${tail}`.slice(0, 320);
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

      if (!existing) {
        return candidate;
      }

      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
  }

  private normalizeVariants(input: unknown): ProductVariantNormalized[] | null {
    if (!Array.isArray(input)) return null;

    const variants: ProductVariantNormalized[] = [];
    const usedKeys = new Set<string>();

    for (const raw of input) {
      if (!raw || typeof raw !== 'object') continue;
      const row = raw as Record<string, unknown>;

      const keyRaw = String(row.key ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      const memoryGbRaw = Number(row.memoryGb ?? NaN);
      const memoryGb =
        Number.isFinite(memoryGbRaw) && memoryGbRaw > 0 ? Math.round(memoryGbRaw) : null;

      const key = keyRaw || (memoryGb ? `${memoryGb}gb` : '');
      if (!key || usedKeys.has(key)) continue;

      const price = Number(row.price ?? 0);
      if (!Number.isFinite(price) || price < 0) continue;

      const stock = Math.max(0, Math.floor(Number(row.stock ?? 0)));
      const costPriceRaw = Number(row.costPrice ?? NaN);
      const costPrice = Number.isFinite(costPriceRaw) && costPriceRaw >= 0 ? costPriceRaw : null;
      const label = String(row.label ?? '').trim() || key.toUpperCase();
      const inStock = row.inStock !== undefined ? Boolean(row.inStock) : stock > 0;
      const isDefault = Boolean(row.isDefault);

      usedKeys.add(key);
      variants.push({
        key,
        label: label.slice(0, 80),
        memoryGb,
        price,
        costPrice,
        stock,
        inStock,
        isDefault,
      });
    }

    if (!variants.length) return null;

    if (!variants.some(v => v.isDefault)) {
      variants[0].isDefault = true;
    }

    return variants;
  }

  private dropManualVariantStock(
    variants: ProductVariantNormalized[] | null,
  ): ProductVariantNormalized[] | null {
    if (!variants) return null;
    return variants.map(variant => ({
      ...variant,
      stock: 0,
      inStock: false,
    }));
  }

  private sumVariantStock(variants: ProductVariantNormalized[]) {
    return variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0);
  }

  private canSeeFinancials(role?: Role | string | null) {
    return role !== Role.MANAGER;
  }

  private maskProductFinancials<T extends Record<string, any>>(
    product: T,
    role?: Role | string | null,
  ): T {
    if (!product || this.canSeeFinancials(role)) return product;
    const next = { ...product } as Record<string, any>;
    delete next.costPrice;
    if (Array.isArray(next.variants)) {
      next.variants = next.variants.map((variant: Record<string, any>) => {
        if (!variant || typeof variant !== 'object') return variant;
        const copy = { ...variant };
        delete copy.costPrice;
        return copy;
      });
    }
    return next as T;
  }

  async list(query?: any, role?: Role | string | null) {
    try {
      await this.ensureBaseCatalogProducts().catch(error => {
        console.error('Catalog seed failed:', error);
      });

      const where: Prisma.ProductWhereInput = {
        tenant: 'TECHNOPRIME',
        serialNumber: null,
      };
      const andFilters: Prisma.ProductWhereInput[] = [];

      const scope = String(query?.scope || '')
        .trim()
        .toLowerCase();
      if (scope === 'warehouse') {
        where.storefrontCategory = null;
      } else if (scope === 'storefront') {
        where.storefrontCategory = { not: null };
      }

      // ✅ ИСПРАВЛЕНО: только валидные категории
      const validCategories = ['CONSOLE', 'ACCESSORY', 'DISK', 'SERVICE', 'SUBSCRIPTION_KEY'];

      if (query?.category && query.category !== 'all' && validCategories.includes(query.category)) {
        where.category = query.category;
      }

      if (query?.isArchived !== undefined) {
        const archived = String(query.isArchived) === 'true';
        where.isArchived = archived;
        where.isActive = !archived;
      }

      const orderableOnly = ['1', 'true', 'yes'].includes(
        String(query?.orderable ?? '')
          .trim()
          .toLowerCase(),
      );
      if (orderableOnly) {
        where.isArchived = false;
        where.isActive = true;
        andFilters.push({
          OR: [{ isAlwaysAvailable: true }, { inStock: true }, { stock: { gt: 0 } }],
        });
      }

      if (query?.q) {
        andFilters.push({
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { brand: { contains: query.q, mode: 'insensitive' } },
            { model: { contains: query.q, mode: 'insensitive' } },
            { serialNumber: { contains: query.q, mode: 'insensitive' } },
          ],
        });
      }

      if (andFilters.length > 0) {
        where.AND = andFilters;
      }

      const parsedLimit = Number(query?.limit ?? 500);
      const limit = Number.isFinite(parsedLimit)
        ? Math.min(Math.max(Math.floor(parsedLimit), 1), 5000)
        : 500;

      const items = await this.prisma.product.findMany({
        where,
        take: limit,
        orderBy: { id: 'desc' },
      });
      const maskedItems = items.map(item => this.maskProductFinancials(item as any, role));

      return {
        items: maskedItems,
        total: maskedItems.length,
        success: true,
      };
    } catch (error) {
      console.error('Error listing products:', error);
      throw error;
    }
  }

  async findOne(id: number, role?: Role | string | null) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Товар #${id} не найден`);
    }

    return this.maskProductFinancials(product as any, role);
  }

  async create(data: any) {
    try {
      const validCategories = ['CONSOLE', 'ACCESSORY', 'DISK', 'SERVICE', 'SUBSCRIPTION_KEY'];
      const category = validCategories.includes(data.category) ? data.category : 'CONSOLE';
      const condition = data?.condition === 'NEW' ? 'NEW' : 'USED';
      const variants = this.dropManualVariantStock(this.normalizeVariants(data.variants));
      const isAlwaysAvailable = Boolean(data.isAlwaysAvailable);
      const stock = 0;
      const inStock = isAlwaysAvailable;
      const slug = await this.makeUniqueSlug({
        slug: data.slug,
        name: data.name,
        brand: data.brand,
        model: data.model,
        version: data.version,
        adSku: data.adSku,
      });
      const shortDescription = this.sanitizeText(data.shortDescription, 1000);
      const description = this.sanitizeText(data.description, 6000);
      const seoTitle =
        this.sanitizeText(data.seoTitle, 200) ||
        this.buildDefaultSeoTitle({
          name: data.name,
          brand: data.brand,
          model: data.model,
          version: data.version,
        });
      const seoDescription =
        this.sanitizeText(data.seoDescription, 320) ||
        this.buildDefaultSeoDescription({
          name: data.name,
          shortDescription,
          description,
        });

      const created = await this.prisma.product.create({
        data: {
          tenant: 'TECHNOPRIME',
          name: data.name,
          slug,
          category: category,
          condition,
          brand: data.brand,
          model: data.model,
          version: data.version,
          shortDescription,
          description,
          seoTitle,
          seoDescription,
          previewImage:
            typeof data.previewImage === 'string' ? data.previewImage.trim() || null : null,
          variants: variants as any,
          stock,
          costPrice: Number(data.costPrice || 0),
          price: Number(data.price || 0),
          isActive: true,
          isAlwaysAvailable,
          inStock,
          storefrontCategory: this.sanitizeStorefrontCategory(data.storefrontCategory),
          catalogMainKey: this.sanitizeCatalogKey(data.catalogMainKey),
          catalogSubKey: this.sanitizeCatalogKey(data.catalogSubKey),
          catalogFamilyKey: this.sanitizeCatalogKey(data.catalogFamilyKey),
          adSku: data.adSku,
        },
      });
      const synced = await this.inventory.recalcProductAvailability(created.id);
      return synced || created;
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
      if (data.category !== undefined && validCategories.includes(data.category))
        updateData.category = data.category;
      if (data.condition !== undefined) {
        updateData.condition = data.condition === 'NEW' ? 'NEW' : 'USED';
      }
      if (data.brand !== undefined) updateData.brand = data.brand;
      if (data.model !== undefined) updateData.model = data.model;
      if (data.version !== undefined) updateData.version = data.version;
      if (data.shortDescription !== undefined) {
        updateData.shortDescription = this.sanitizeText(data.shortDescription, 1000);
      }
      if (data.description !== undefined) {
        updateData.description = this.sanitizeText(data.description, 6000);
      }
      if (data.slug !== undefined) {
        updateData.slug = await this.makeUniqueSlug(
          {
            id,
            slug: data.slug,
            name: data.name ?? exists.name,
            brand: data.brand ?? exists.brand,
            model: data.model ?? exists.model,
            version: data.version ?? exists.version,
            adSku: data.adSku ?? exists.adSku,
          },
          id,
        );
      }
      if (data.seoTitle !== undefined) {
        updateData.seoTitle = this.sanitizeText(data.seoTitle, 200);
      }
      if (data.seoDescription !== undefined) {
        updateData.seoDescription = this.sanitizeText(data.seoDescription, 320);
      }
      if (data.previewImage !== undefined) {
        updateData.previewImage =
          typeof data.previewImage === 'string' ? data.previewImage.trim() || null : null;
      }
      const variantsFromPayload =
        data.variants !== undefined
          ? this.dropManualVariantStock(this.normalizeVariants(data.variants))
          : undefined;

      if (data.variants !== undefined) {
        updateData.variants = variantsFromPayload ? (variantsFromPayload as any) : null;
      }
      if (data.costPrice !== undefined) updateData.costPrice = Number(data.costPrice);
      if (data.price !== undefined) updateData.price = Number(data.price);
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.isAlwaysAvailable !== undefined) {
        updateData.isAlwaysAvailable = Boolean(data.isAlwaysAvailable);
        if (data.isAlwaysAvailable) {
          updateData.inStock = true;
        }
      }
      if (data.storefrontCategory !== undefined) {
        updateData.storefrontCategory = this.sanitizeStorefrontCategory(data.storefrontCategory);
      }
      if (data.catalogMainKey !== undefined) {
        updateData.catalogMainKey = this.sanitizeCatalogKey(data.catalogMainKey);
      }
      if (data.catalogSubKey !== undefined) {
        updateData.catalogSubKey = this.sanitizeCatalogKey(data.catalogSubKey);
      }
      if (data.catalogFamilyKey !== undefined) {
        updateData.catalogFamilyKey = this.sanitizeCatalogKey(data.catalogFamilyKey);
      }
      if (data.adSku !== undefined) updateData.adSku = data.adSku;

      const nextName = data.name !== undefined ? data.name : exists.name;
      const nextBrand = data.brand !== undefined ? data.brand : exists.brand;
      const nextModel = data.model !== undefined ? data.model : exists.model;
      const nextVersion = data.version !== undefined ? data.version : exists.version;
      const nextShortDescription =
        data.shortDescription !== undefined ? updateData.shortDescription : exists.shortDescription;
      const nextDescription =
        data.description !== undefined ? updateData.description : exists.description;

      if (updateData.slug === undefined && !exists.slug) {
        updateData.slug = await this.makeUniqueSlug(
          {
            id,
            name: nextName,
            brand: nextBrand,
            model: nextModel,
            version: nextVersion,
            adSku: data.adSku ?? exists.adSku,
          },
          id,
        );
      }

      if (updateData.seoTitle === undefined && !exists.seoTitle) {
        updateData.seoTitle = this.buildDefaultSeoTitle({
          name: nextName,
          brand: nextBrand,
          model: nextModel,
          version: nextVersion,
        });
      }

      if (updateData.seoDescription === undefined && !exists.seoDescription) {
        updateData.seoDescription = this.buildDefaultSeoDescription({
          name: nextName,
          shortDescription: nextShortDescription,
          description: nextDescription,
        });
      }

      const updated = await this.prisma.product.update({
        where: { id },
        data: updateData,
      });
      const synced = await this.inventory.recalcProductAvailability(updated.id);
      return synced || updated;
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
          isArchived: true,
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
          isArchived: false,
          archivedAt: null,
        },
      });
    } catch (error: any) {
      console.error('Error unarchiving product:', error);
      throw new BadRequestException(error.message);
    }
  }

  async adjustWarehouseStockByDelta(productId: number, delta: number) {
    if (!Number.isFinite(productId) || productId <= 0) {
      throw new BadRequestException('Некорректный id товара');
    }

    const change = Math.trunc(Number(delta || 0));
    if (change === 0) {
      const current = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, stock: true, inStock: true },
      });
      if (!current) {
        throw new NotFoundException(`Товар #${productId} не найден`);
      }
      return {
        success: true,
        productId,
        delta: 0,
        stock: current.stock,
        inStock: current.inStock,
      };
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        category: true,
        brand: true,
        model: true,
        version: true,
        storefrontCategory: true,
        costPrice: true,
        price: true,
        variants: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Товар #${productId} не найден`);
    }
    if (product.storefrontCategory) {
      throw new BadRequestException(
        'Нельзя менять остаток у карточки витрины. Изменяйте складскую позицию.',
      );
    }

    const variants = this.normalizeVariants(product.variants);
    const defaultVariant = variants?.find(variant => variant.isDefault) || variants?.[0] || null;

    await this.prisma.$transaction(async tx => {
      const affectedIds = new Set<number>([product.id]);
      if (change > 0) {
        const amount = Math.max(1, change);
        const now = Date.now();
        await tx.inventoryUnit.createMany({
          data: Array.from({ length: amount }, (_row, index) => ({
            tenant: 'TECHNOPRIME',
            productId: product.id,
            storefrontProductId: null,
            category: product.category,
            brand: product.brand,
            model: product.model,
            version: product.version,
            displayName: product.name,
            serialNumber: null,
            variantKey: defaultVariant?.key || null,
            variantLabel: defaultVariant?.label || null,
            memoryGb: defaultVariant?.memoryGb ?? null,
            status: InventoryUnitStatus.AVAILABLE,
            attachedAt: new Date(now + index),
            purchasePrice: product.costPrice,
            salePrice: product.price,
          })),
        });
      } else {
        const amount = Math.abs(change);
        const removable = await tx.inventoryUnit.findMany({
          where: {
            tenant: 'TECHNOPRIME',
            productId: product.id,
            status: InventoryUnitStatus.AVAILABLE,
          },
          orderBy: [{ attachedAt: 'asc' }, { id: 'asc' }],
          take: amount,
          select: {
            id: true,
            storefrontProductId: true,
          },
        });

        if (removable.length < amount) {
          throw new BadRequestException(
            `Недостаточно доступных единиц для уменьшения. Доступно: ${removable.length}`,
          );
        }

        for (const row of removable) {
          if (row.storefrontProductId) affectedIds.add(row.storefrontProductId);
        }

        await tx.inventoryUnit.deleteMany({
          where: { id: { in: removable.map(row => row.id) } },
        });
      }

      await this.inventory.recalcProductsAvailability(Array.from(affectedIds), tx);
    });

    const refreshed = await this.prisma.product.findUnique({
      where: { id: product.id },
      select: { stock: true, inStock: true },
    });

    return {
      success: true,
      productId: product.id,
      delta: change,
      stock: refreshed?.stock ?? 0,
      inStock: refreshed?.inStock ?? false,
    };
  }

  async attachStockFromWarehouse(
    targetProductId: number,
    sourceProductId: number,
    qty: number,
    targetVariantKey?: string | null,
  ) {
    if (!Number.isFinite(targetProductId) || targetProductId <= 0) {
      throw new BadRequestException('Неверная карточка витрины');
    }
    if (!Number.isFinite(sourceProductId) || sourceProductId <= 0) {
      throw new BadRequestException('Неверная складская позиция');
    }
    if (targetProductId === sourceProductId) {
      throw new BadRequestException('Источник и карточка витрины должны отличаться');
    }
    if (!Number.isFinite(qty) || Number(qty) <= 0) {
      throw new BadRequestException('Количество должно быть больше 0');
    }
    const amount = Math.max(1, Math.floor(Number(qty)));

    const [target, source] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: targetProductId },
        select: {
          id: true,
          name: true,
          storefrontCategory: true,
          variants: true,
        },
      }),
      this.prisma.product.findUnique({
        where: { id: sourceProductId },
        select: {
          id: true,
          name: true,
          storefrontCategory: true,
          variants: true,
        },
      }),
    ]);

    if (!target) {
      throw new NotFoundException(`Карточка #${targetProductId} не найдена`);
    }
    if (!source) {
      throw new NotFoundException(`Складская позиция #${sourceProductId} не найдена`);
    }
    if (!target.storefrontCategory) {
      throw new BadRequestException('Наличие можно добавлять только к карточке витрины');
    }
    if (source.storefrontCategory) {
      throw new BadRequestException(
        'Источник должен быть складской позицией, не карточкой витрины',
      );
    }

    const targetVariants = this.normalizeVariants(target.variants) || [];
    const targetHasVariants = targetVariants.length > 0;
    const forcedVariantKey = String(targetVariantKey || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const forcedVariant =
      targetHasVariants && forcedVariantKey
        ? targetVariants.find(variant => variant.key === forcedVariantKey) || null
        : null;

    if (targetHasVariants && forcedVariantKey && !forcedVariant) {
      throw new BadRequestException(`Вариант ${forcedVariantKey} не найден в карточке витрины`);
    }

    const moved = await this.prisma.$transaction(async tx => {
      const units = await tx.inventoryUnit.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          productId: source.id,
          storefrontProductId: null,
          status: InventoryUnitStatus.AVAILABLE,
        },
        orderBy: [{ attachedAt: 'asc' }, { id: 'asc' }],
        take: amount,
        select: {
          id: true,
          variantKey: true,
          variantLabel: true,
          memoryGb: true,
        },
      });

      if (units.length < amount) {
        throw new BadRequestException(
          `Недостаточно реальных единиц на складе. Доступно: ${units.length}`,
        );
      }

      const now = Date.now();
      for (let index = 0; index < units.length; index += 1) {
        const unit = units[index];
        let variantKey: string | null = null;
        let variantLabel: string | null = null;
        let memoryGb: number | null = unit.memoryGb ?? null;

        if (targetHasVariants) {
          let chosen = forcedVariant;
          if (!chosen) {
            const byExactKey = targetVariants.find(
              variant =>
                variant.key ===
                String(unit.variantKey || '')
                  .trim()
                  .toLowerCase(),
            );
            chosen = byExactKey || null;
          }

          if (!chosen && typeof unit.memoryGb === 'number' && unit.memoryGb > 0) {
            const withMemory = targetVariants
              .filter(
                variant => typeof variant.memoryGb === 'number' && Number(variant.memoryGb) > 0,
              )
              .sort((a, b) => {
                const aDiff = Math.abs(Number(a.memoryGb || 0) - Number(unit.memoryGb || 0));
                const bDiff = Math.abs(Number(b.memoryGb || 0) - Number(unit.memoryGb || 0));
                return aDiff - bDiff;
              });
            chosen = withMemory[0] || null;
          }

          if (!chosen) {
            chosen = targetVariants.find(variant => variant.isDefault) || targetVariants[0] || null;
          }

          variantKey = chosen?.key || null;
          variantLabel = chosen?.label || null;
          memoryGb = chosen?.memoryGb ?? memoryGb;
        }

        await tx.inventoryUnit.update({
          where: { id: unit.id },
          data: {
            storefrontProductId: target.id,
            variantKey,
            variantLabel,
            memoryGb,
            attachedAt: new Date(now + index),
          },
        });
      }

      await this.inventory.recalcProductsAvailability([source.id, target.id], tx);

      return units.length;
    });

    return {
      success: true,
      movedQty: moved,
      sourceProductId,
      targetProductId,
    };
  }

  async listStorefrontCategories() {
    await this.ensureBaseCatalogProducts().catch(error => {
      console.error('Catalog seed failed:', error);
    });

    const products = await this.prisma.product.findMany({
      where: { tenant: 'TECHNOPRIME', serialNumber: null },
      select: { storefrontCategory: true },
    });

    const set = new Set<string>(this.defaultStorefrontCategories);
    for (const product of products) {
      if (product.storefrontCategory?.trim()) {
        set.add(product.storefrontCategory.trim());
      }
    }

    return Array.from(set).map(value => ({
      value,
      label: value,
    }));
  }

  async addImages(id: number, filenames: string[]) {
    const exists = await this.findOne(id);
    if (!exists) {
      throw new NotFoundException(`Товар #${id} не найден`);
    }

    const fresh = await this.prisma.product.findUnique({
      where: { id },
      select: { gallery: true, coverImage: true },
    });

    const currentGallery = this.normalizeGallery(fresh?.gallery);
    const baseUrl = `/assets/shop/products/${id}`;
    const appended = filenames.map(name => `${baseUrl}/${name}`);
    const nextGallery = [...currentGallery, ...appended];

    const nextCover = fresh?.coverImage || appended[0] || null;

    return this.prisma.product.update({
      where: { id },
      data: {
        gallery: nextGallery as any,
        coverImage: nextCover,
      },
      select: {
        id: true,
        coverImage: true,
        previewImage: true,
        gallery: true,
      },
    });
  }

  async uploadPreviewImage(id: number, filename: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, previewImage: true },
    });
    if (!product) {
      throw new NotFoundException(`Товар #${id} не найден`);
    }

    const nextPreview = `/assets/shop/products/${id}/${filename}`;
    const currentPreview = product.previewImage || null;
    const urlPrefix = `/assets/shop/products/${id}/`;

    if (currentPreview && currentPreview.startsWith(urlPrefix)) {
      const oldFilename = currentPreview.slice(urlPrefix.length);
      if (oldFilename && oldFilename !== filename) {
        const oldPath = join(this.assetsDirForProduct(id), oldFilename);
        await fs.unlink(oldPath).catch(() => undefined);
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: { previewImage: nextPreview },
      select: { id: true, previewImage: true, coverImage: true, gallery: true },
    });
  }

  async setPreviewImage(id: number, url: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { gallery: true, coverImage: true },
    });
    if (!product) {
      throw new NotFoundException(`Товар #${id} не найден`);
    }

    const normalizedUrl = String(url || '').trim();
    if (!normalizedUrl) {
      throw new BadRequestException('URL превью не указан');
    }

    const gallery = this.normalizeGallery(product.gallery);
    const available = new Set<string>([...gallery, product.coverImage || ''].filter(Boolean));
    if (!available.has(normalizedUrl)) {
      throw new BadRequestException('URL превью должен быть из фото товара');
    }

    return this.prisma.product.update({
      where: { id },
      data: { previewImage: normalizedUrl },
      select: { id: true, previewImage: true, coverImage: true, gallery: true },
    });
  }

  async removePreviewImage(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { previewImage: true },
    });
    if (!product) {
      throw new NotFoundException(`Товар #${id} не найден`);
    }

    const currentPreview = product.previewImage || null;
    const urlPrefix = `/assets/shop/products/${id}/`;

    if (currentPreview && currentPreview.startsWith(urlPrefix)) {
      const filename = currentPreview.slice(urlPrefix.length);
      if (filename) {
        const filePath = join(this.assetsDirForProduct(id), filename);
        await fs.unlink(filePath).catch(() => undefined);
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: { previewImage: null },
      select: { id: true, previewImage: true, coverImage: true, gallery: true },
    });
  }

  async setCoverImage(id: number, url: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { gallery: true },
    });
    if (!product) {
      throw new NotFoundException(`Товар #${id} не найден`);
    }

    const gallery = this.normalizeGallery(product.gallery);
    if (!gallery.includes(url)) {
      throw new BadRequestException('Изображение не найдено в галерее товара');
    }

    return this.prisma.product.update({
      where: { id },
      data: { coverImage: url },
      select: { id: true, coverImage: true, previewImage: true, gallery: true },
    });
  }

  async reorderImages(id: number, images: string[]) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { gallery: true, coverImage: true },
    });
    if (!product) {
      throw new NotFoundException(`Товар #${id} не найден`);
    }

    const current = this.normalizeGallery(product.gallery);
    const filtered = images.filter(url => current.includes(url));
    const missed = current.filter(url => !filtered.includes(url));
    const next = [...filtered, ...missed];

    const nextCover =
      product.coverImage && next.includes(product.coverImage)
        ? product.coverImage
        : next[0] || null;

    return this.prisma.product.update({
      where: { id },
      data: {
        gallery: next as any,
        coverImage: nextCover,
      },
      select: { id: true, coverImage: true, previewImage: true, gallery: true },
    });
  }

  async removeImage(id: number, url: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { gallery: true, coverImage: true, previewImage: true },
    });
    if (!product) {
      throw new NotFoundException(`Товар #${id} не найден`);
    }

    const current = this.normalizeGallery(product.gallery);
    const next = current.filter(item => item !== url);
    const nextCover = product.coverImage === url ? next[0] || null : product.coverImage;
    const nextPreview = product.previewImage === url ? null : product.previewImage;

    const urlPrefix = `/assets/shop/products/${id}/`;
    if (url.startsWith(urlPrefix)) {
      const filename = url.slice(urlPrefix.length);
      const filePath = join(this.assetsDirForProduct(id), filename);
      await fs.unlink(filePath).catch(() => undefined);
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        gallery: next as any,
        coverImage: nextCover,
        previewImage: nextPreview,
      },
      select: { id: true, coverImage: true, previewImage: true, gallery: true },
    });
  }
}
