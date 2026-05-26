import Link from 'next/link';
import { SectionTitle } from '@technoprime/ui';
import { ProductCard } from '@/components/product-card';
import { AlsoBuyCarousel } from '@/components/also-buy-carousel';
import { MobileCatalogFilter } from '@/components/mobile-catalog-filter';
import { fetchShopProducts, fetchTopViewedProducts, ShopProduct } from '@/lib/shop-api';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Каталог игровых приставок и аксессуаров | TechnoPrime',
  description:
    'Каталог TechnoPrime: PlayStation, Xbox, Steam Deck, портативные приставки, диски и цифровые сервисы с актуальным наличием.',
  path: '/catalog',
});

type MainCategory = {
  key: string;
  label: string;
  description: string;
  storeCategory: string;
  tone: string;
};

type SubCategory = {
  key: string;
  mainKey: string;
  label: string;
  description: string;
  tone: string;
  match: (product: ShopProduct) => boolean;
};

type FamilyCategory = {
  key: string;
  mainKey: string;
  subKey: string;
  label: string;
  subtitle: string;
  tone: string;
  match: (product: ShopProduct) => boolean;
};

type CatalogCard = {
  id: number;
  slug?: string | null;
  name: string;
  price: number;
  originalPrice?: number | null;
  badge?: string;
  meta?: string;
  summary?: string | null;
  specs?: string[];
  coverImage?: string | null;
  previewImage?: string | null;
  inStock?: boolean | null;
  isPromo?: boolean;
  promoRemainingSec?: number;
  variantKey?: string | null;
  variantLabel?: string | null;
};

const MAIN_CATEGORIES: MainCategory[] = [
  {
    key: 'home-consoles',
    label: 'Игровые приставки',
    description: 'Стационарные консоли: PlayStation и Xbox',
    storeCategory: 'HOME_CONSOLES',
    tone: 'from-[#163764] via-[#22548C] to-[#2F80CC]',
  },
  {
    key: 'portable-consoles',
    label: 'Портативные приставки',
    description: 'PlayStation Portal, Steam Deck, Nintendo Switch',
    storeCategory: 'PORTABLE_CONSOLES',
    tone: 'from-[#17345F] via-[#1E4E81] to-[#2B6FB4]',
  },
  {
    key: 'game-disks',
    label: 'Игровые диски',
    description: 'Только реальные позиции, которые есть в наличии',
    storeCategory: 'GAME_DISKS',
    tone: 'from-[#14345C] via-[#1D4878] to-[#2A67A8]',
  },
  {
    key: 'digital-services',
    label: 'Цифровые сервисы',
    description: 'Подписки и цифровые товары',
    storeCategory: 'DIGITAL_SERVICES',
    tone: 'from-[#123258] via-[#1B426F] to-[#255D98]',
  },
];

const SUB_CATEGORIES: SubCategory[] = [
  {
    key: 'playstation',
    mainKey: 'home-consoles',
    label: 'PlayStation',
    description: 'Линейка домашних консолей Sony',
    tone: 'from-[#194073] via-[#245895] to-[#2E77BE]',
    match: (product) => contains(product, ['playstation']),
  },
  {
    key: 'xbox',
    mainKey: 'home-consoles',
    label: 'Xbox',
    description: 'Линейка домашних консолей Microsoft',
    tone: 'from-[#153A69] via-[#1F4E81] to-[#2B6AA9]',
    match: (product) => contains(product, ['xbox']),
  },
  {
    key: 'portable-playstation',
    mainKey: 'portable-consoles',
    label: 'PlayStation',
    description: 'Портативная линейка Sony',
    tone: 'from-[#1A3E72] via-[#255A99] to-[#2F79C2]',
    match: (product) => contains(product, ['playstation', 'portal']),
  },
  {
    key: 'steam-deck',
    mainKey: 'portable-consoles',
    label: 'Steam Deck',
    description: 'Портативные устройства Valve',
    tone: 'from-[#173864] via-[#1F4C7D] to-[#2C6AA7]',
    match: (product) => contains(product, ['steam', 'deck']),
  },
  {
    key: 'nintendo-switch',
    mainKey: 'portable-consoles',
    label: 'Nintendo Switch',
    description: 'Портативные устройства Nintendo',
    tone: 'from-[#183862] via-[#1F4A76] to-[#275F95]',
    match: (product) => contains(product, ['nintendo', 'switch']),
  },
];

const FAMILY_CATEGORIES: FamilyCategory[] = [
  {
    key: 'ps4',
    mainKey: 'home-consoles',
    subKey: 'playstation',
    label: 'PlayStation 4',
    subtitle: 'FAT / Slim / Pro',
    tone: 'from-[#1C4478] via-[#265C97] to-[#347BC3]',
    match: (product) => contains(product, ['playstation 4']),
  },
  {
    key: 'ps5',
    mainKey: 'home-consoles',
    subKey: 'playstation',
    label: 'PlayStation 5',
    subtitle: 'FAT / Slim · Digital / Blu-Ray',
    tone: 'from-[#1A4275] via-[#245791] to-[#2F73B9]',
    match: (product) => contains(product, ['playstation 5']),
  },
  {
    key: 'xbox-one',
    mainKey: 'home-consoles',
    subKey: 'xbox',
    label: 'Xbox One',
    subtitle: 'One S / One X',
    tone: 'from-[#163B69] via-[#1F4F81] to-[#2B6BA9]',
    match: (product) => contains(product, ['xbox one']),
  },
  {
    key: 'xbox-series',
    mainKey: 'home-consoles',
    subKey: 'xbox',
    label: 'Xbox Series',
    subtitle: 'Series S / Series X',
    tone: 'from-[#14365F] via-[#1C4775] to-[#265F98]',
    match: (product) => contains(product, ['xbox series']),
  },
  {
    key: 'playstation-portal',
    mainKey: 'portable-consoles',
    subKey: 'portable-playstation',
    label: 'PlayStation Portal',
    subtitle: 'Отдельная категория',
    tone: 'from-[#1A4175] via-[#255997] to-[#2F75BC]',
    match: (product) => contains(product, ['playstation', 'portal']),
  },
  {
    key: 'steam-deck-lcd',
    mainKey: 'portable-consoles',
    subKey: 'steam-deck',
    label: 'Steam Deck LCD',
    subtitle: '512GB / 1024GB',
    tone: 'from-[#173A67] via-[#214F83] to-[#2B69A6]',
    match: (product) => contains(product, ['steam deck', 'lcd']),
  },
  {
    key: 'steam-deck-oled',
    mainKey: 'portable-consoles',
    subKey: 'steam-deck',
    label: 'Steam Deck OLED',
    subtitle: '512GB / 1024GB',
    tone: 'from-[#163762] via-[#1D4A7A] to-[#275F98]',
    match: (product) => contains(product, ['steam deck', 'oled']),
  },
  {
    key: 'switch-lite',
    mainKey: 'portable-consoles',
    subKey: 'nintendo-switch',
    label: 'Nintendo Switch Lite',
    subtitle: 'Отдельная категория',
    tone: 'from-[#173865] via-[#1F4D80] to-[#2A69A6]',
    match: (product) => contains(product, ['nintendo switch lite']),
  },
  {
    key: 'switch-2',
    mainKey: 'portable-consoles',
    subKey: 'nintendo-switch',
    label: 'Nintendo Switch 2',
    subtitle: 'Отдельная категория',
    tone: 'from-[#15345C] via-[#1A446E] to-[#235789]',
    match: (product) => contains(product, ['nintendo switch 2']),
  },
];

function textOf(product: ShopProduct) {
  return [product.name, product.brand, product.model, product.version]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function contains(product: ShopProduct, tokens: string[]) {
  const hay = textOf(product);
  return tokens.every((token) => hay.includes(token.toLowerCase()));
}

function buildCatalogHref(params: {
  main?: string | null;
  sub?: string | null;
  family?: string | null;
  q?: string | null;
}) {
  const search = new URLSearchParams();
  if (params.main) search.set('main', params.main);
  if (params.sub) search.set('sub', params.sub);
  if (params.family) search.set('family', params.family);
  if (params.q) search.set('q', params.q);

  const raw = search.toString();
  return raw ? `/catalog?${raw}` : '/catalog';
}

function defaultBundle(product: ShopProduct) {
  if (contains(product, ['steam', 'deck'])) {
    return 'Комплект: консоль, зарядное устройство, документация.';
  }
  if (contains(product, ['switch'])) {
    return 'Комплект: консоль, блок питания, документация.';
  }
  if (contains(product, ['playstation', 'portal'])) {
    return 'Комплект: устройство, кабель USB-C, документация.';
  }
  return 'Комплект: консоль, геймпад, кабель питания и HDMI.';
}

function detectMemory(product: ShopProduct) {
  const raw = [product.version, product.name, product.model].filter(Boolean).join(' ');
  const match = raw.match(/(\d{3,4})\s?GB/i);
  if (!match) return null;
  return `${match[1]} ГБ`;
}

function detectDisplay(product: ShopProduct) {
  const text = textOf(product);
  if (text.includes('steam deck oled')) return 'OLED';
  if (text.includes('steam deck lcd')) return 'LCD';
  if (text.includes('playstation portal')) return 'LCD';
  if (text.includes('switch')) return 'LCD';
  return null;
}

function detectDiscSupport(product: ShopProduct) {
  const text = textOf(product);
  if (text.includes('xbox series s')) return 'Без дисковода';
  if (text.includes('xbox series x')) return 'С дисководом';
  if (text.includes('playstation 5')) {
    if (text.includes('digital')) return 'Без дисковода (Digital Edition)';
    if (
      text.includes('blu-ray') ||
      text.includes('bluray') ||
      text.includes('blue ray') ||
      text.includes('дисковод')
    ) {
      return 'С дисководом (Blu-Ray Edition)';
    }
    return 'Digital / Blu-Ray';
  }
  if (text.includes('xbox one')) return 'С дисководом';
  return null;
}

function resolveDefaultVariant(product: ShopProduct) {
  if (!Array.isArray(product.variants) || product.variants.length === 0) return null;
  return product.variants.find((variant) => variant.isDefault) || product.variants[0];
}

function mapProducts(apiProducts: ShopProduct[]): CatalogCard[] {
  const nameSet = new Set(
    apiProducts.map((item) => String(item.name || '').trim().toLowerCase()),
  );
  const hasSplitPs5 =
    nameSet.has('sony playstation 5 fat digital') ||
    nameSet.has('sony playstation 5 fat blu-ray') ||
    nameSet.has('sony playstation 5 slim digital') ||
    nameSet.has('sony playstation 5 slim blu-ray');

  return apiProducts
    .filter((item) => {
      if (!hasSplitPs5) return true;
      const itemName = String(item.name || '').trim().toLowerCase();
      const version = String(item.version || '').trim().toLowerCase();
      return !(
        (itemName === 'playstation 5 fat' || itemName === 'playstation 5 slim') &&
        version.includes('digital / blu-ray')
      );
    })
    .map((item) => {
      const defaultVariant = resolveDefaultVariant(item);
      const memory = detectMemory(item);
      const display = detectDisplay(item);
      const discSupport = detectDiscSupport(item);
      const currentPrice = Number(defaultVariant?.price ?? item.price ?? 0);
      const originalPrice = Number(
        defaultVariant?.promoOldPrice ?? defaultVariant?.originalPrice ?? item.originalPrice ?? 0,
      );

      const specs = [
        item.version ? `Версия: ${item.version}` : null,
        item.model ? `Модель: ${item.model}` : null,
        item.brand ? `Бренд: ${item.brand}` : null,
        `Состояние: ${item.condition === 'NEW' ? 'Новое' : 'Б/У'}`,
        memory ? `Объём памяти: ${memory}` : null,
        display ? `Дисплей: ${display}` : null,
        discSupport ? `Дисковод: ${discSupport}` : null,
      ].filter((value): value is string => Boolean(value));

      return {
        id: item.id,
        slug: item.slug,
        name: item.name,
        price: currentPrice,
        originalPrice: originalPrice > currentPrice ? originalPrice : null,
        badge: item.inStock ? 'В наличии' : 'Под заказ',
        meta: [item.brand, item.model].filter(Boolean).join(' · '),
        summary: item.shortDescription?.trim() || defaultBundle(item),
        specs,
        coverImage: item.coverImage || null,
        previewImage: item.previewImage || item.coverImage || null,
        inStock: item.inStock ?? null,
        isPromo: Boolean(defaultVariant?.isPromo || item.isPromo),
        promoRemainingSec: Number(defaultVariant?.promoRemainingSec ?? item.promoRemainingSec ?? 0),
        variantKey: defaultVariant?.key || null,
        variantLabel: defaultVariant?.label || null,
      };
    });
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; main?: string; sub?: string; family?: string }>;
}) {
  const params = await searchParams;

  const rawQ = (params.q || '').trim();
  const mainKey = (params.main || '').trim();
  const subKey = (params.sub || '').trim();
  const familyKey = (params.family || '').trim();

  const selectedMain = MAIN_CATEGORIES.find((item) => item.key === mainKey) || null;
  const selectedSubCandidates = selectedMain
    ? SUB_CATEGORIES.filter((item) => item.mainKey === selectedMain.key)
    : [];
  const selectedSub = selectedSubCandidates.find((item) => item.key === subKey) || null;
  const selectedFamilyCandidates = selectedSub
    ? FAMILY_CATEGORIES.filter(
        (item) => item.mainKey === selectedMain?.key && item.subKey === selectedSub.key,
      )
    : [];
  const selectedFamily =
    selectedFamilyCandidates.find((item) => item.key === familyKey) || null;

  const searchEnabled = !selectedMain;
  const q = searchEnabled ? rawQ : '';

  const showRootCategories = !selectedMain;
  const showSubCategories = Boolean(selectedMain && !selectedSub && selectedSubCandidates.length > 0);
  const showFamilyCategories = Boolean(
    selectedSub && !selectedFamily && selectedFamilyCandidates.length > 0,
  );

  const showProducts = Boolean(
    (!selectedMain && q) ||
      (selectedMain && selectedSubCandidates.length === 0) ||
      (selectedSub && selectedFamilyCandidates.length === 0) ||
      selectedFamily,
  );

  const [apiProducts, topViewedSource] = showProducts
    ? await Promise.all([
        fetchShopProducts({
          q: !selectedMain ? q || undefined : undefined,
          storeCategory: selectedMain?.storeCategory,
          limit: 300,
        }),
        fetchTopViewedProducts(12, 45),
      ])
    : [[], []];

  let scopedProducts = apiProducts;
  if (selectedSub) {
    scopedProducts = scopedProducts.filter((product) => {
      const explicitSub = String(product.catalogSubKey || '').trim();
      if (explicitSub) return explicitSub === selectedSub.key;
      return selectedSub.match(product);
    });
  }
  if (selectedFamily) {
    scopedProducts = scopedProducts.filter((product) => {
      const explicitFamily = String(product.catalogFamilyKey || '').trim();
      if (explicitFamily) return explicitFamily === selectedFamily.key;
      return selectedFamily.match(product);
    });
  }

  const products = mapProducts(scopedProducts);
  const currentProductIds = new Set(products.map((item) => item.id));
  const alsoBuyPrimary = mapProducts(topViewedSource)
    .filter((item) => !currentProductIds.has(item.id))
    .slice(0, 8);

  const fallbackPool = showProducts && alsoBuyPrimary.length < 4
    ? await fetchShopProducts({ limit: 80 })
    : [];
  const alsoBuyFallback = mapProducts(fallbackPool).filter(
    (item) =>
      !currentProductIds.has(item.id) &&
      !alsoBuyPrimary.some((candidate) => candidate.id === item.id),
  );
  const alsoBuyItems = [...alsoBuyPrimary, ...alsoBuyFallback].slice(0, 8);

  const subtitle = !selectedMain
    ? 'Выберите категорию и дальше двигайтесь по подкатегориям до карточек товаров.'
    : selectedFamily
      ? `${selectedFamily.label}: карточки товаров`
      : selectedSub
        ? `Выберите категорию внутри ${selectedSub.label}`
        : `Выберите подкатегорию в разделе ${selectedMain.label}`;

  const backHref = selectedFamily
    ? buildCatalogHref({ main: selectedMain?.key, sub: selectedSub?.key })
    : selectedSub
      ? buildCatalogHref({ main: selectedMain?.key })
      : selectedMain
        ? '/catalog'
        : null;

  const tileClass = (tone: string) =>
    `group relative overflow-hidden rounded-2xl border border-cyan-200/35 bg-gradient-to-br ${tone} p-6 shadow-[0_18px_36px_-24px_rgba(47,134,255,0.95)] transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-100/70 hover:shadow-[0_24px_48px_-18px_rgba(47,134,255,0.95)]`;

  return (
    <div className="space-y-8">
      <SectionTitle eyebrow="Каталог" title="Категории TechnoPrime" subtitle={subtitle} />

      {searchEnabled ? (
        <>
          <form className="hidden gap-3 rounded-2xl border border-cyan-100/35 bg-white/10 p-4 md:grid md:grid-cols-[1fr_auto_auto]">
            <input
              defaultValue={q}
              name="q"
              placeholder="Поиск по названию, бренду, модели"
              className="w-full rounded-xl border border-cyan-100/35 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-300"
            />
            <button className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:brightness-105 transition">
              Найти
            </button>
            <Link
              href="/catalog"
              className="rounded-xl border border-cyan-100/35 bg-white/10 px-4 py-3 text-sm text-slate-100 text-center hover:bg-white/20 transition"
            >
              Сброс
            </Link>
          </form>
          <MobileCatalogFilter defaultQuery={q} />
        </>
      ) : null}

      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white transition"
        >
          <span aria-hidden="true">←</span>
          <span>Назад</span>
        </Link>
      ) : null}

      <nav className="text-xs text-slate-400">
        <Link href="/" className="hover:text-slate-200 transition">Главная</Link>
        <span className="mx-2 text-slate-600">/</span>
        <Link href="/catalog" className="hover:text-slate-200 transition">Каталог</Link>
        {selectedMain ? (
          <>
            <span className="mx-2 text-slate-600">/</span>
            <Link
              href={buildCatalogHref({ main: selectedMain.key })}
              className="hover:text-slate-200 transition"
            >
            {selectedMain.label}
            </Link>
          </>
        ) : null}
        {selectedSub ? (
          <>
            <span className="mx-2 text-slate-600">/</span>
            <Link
              href={buildCatalogHref({ main: selectedMain?.key, sub: selectedSub.key })}
              className="hover:text-slate-200 transition"
            >
            {selectedSub.label}
            </Link>
          </>
        ) : null}
        {selectedFamily ? (
          <>
            <span className="mx-2 text-slate-600">/</span>
            <span className="text-slate-300">{selectedFamily.label}</span>
          </>
        ) : null}
      </nav>

      {showRootCategories ? (
        <div className="grid gap-4 md:grid-cols-2">
          {MAIN_CATEGORIES.map((category) => (
            <Link
              key={category.key}
              href={buildCatalogHref({ main: category.key })}
              className={tileClass(category.tone)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-xl font-semibold leading-tight text-white">{category.label}</div>
                <span className="text-cyan-100/90 transition-transform group-hover:translate-x-1">
                  →
                </span>
              </div>
              <div className="mt-2 text-sm text-slate-100/90">{category.description}</div>
            </Link>
          ))}
        </div>
      ) : null}

      {showSubCategories ? (
        <div className="grid gap-4 md:grid-cols-2">
          {selectedSubCandidates.map((category) => (
            <Link
              key={category.key}
              href={buildCatalogHref({ main: selectedMain?.key, sub: category.key })}
              className={tileClass(category.tone)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-xl font-semibold leading-tight text-white">{category.label}</div>
                <span className="text-cyan-100/90 transition-transform group-hover:translate-x-1">
                  →
                </span>
              </div>
              <div className="mt-2 text-sm text-slate-100/90">{category.description}</div>
            </Link>
          ))}
        </div>
      ) : null}

      {showFamilyCategories ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {selectedFamilyCandidates.map((category) => (
            <Link
              key={category.key}
              href={buildCatalogHref({
                main: selectedMain?.key,
                sub: selectedSub?.key,
                family: category.key,
              })}
              className={tileClass(category.tone)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-lg font-semibold leading-tight text-white">{category.label}</div>
                <span className="text-cyan-100/90 transition-transform group-hover:translate-x-1">
                  →
                </span>
              </div>
              <div className="mt-2 text-sm text-slate-100/90">{category.subtitle}</div>
            </Link>
          ))}
        </div>
      ) : null}

      {!showProducts && !showRootCategories && !showSubCategories && !showFamilyCategories ? (
        <div className="rounded-2xl border border-white/20 bg-white/10 p-6 text-sm text-slate-200">
          В выбранной категории пока нет данных.
        </div>
      ) : null}

      {showProducts && products.length === 0 ? (
        <div className="rounded-2xl border border-white/20 bg-white/10 p-6 text-sm text-slate-200">
          В этой категории товары временно закончились. Попробуйте соседние разделы или загляните позже.
        </div>
      ) : null}

      {showProducts && products.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
      ) : null}

      {showProducts && products.length > 0 && alsoBuyItems.length > 0 ? (
        <div className="space-y-4">
          <SectionTitle
            eyebrow="Рекомендуем"
            title="С этим покупают"
            subtitle="Популярные дополнения, которые чаще всего берут вместе с выбранной категорией."
            className="space-y-2"
          />
          <AlsoBuyCarousel items={alsoBuyItems} />
        </div>
      ) : null}
    </div>
  );
}
