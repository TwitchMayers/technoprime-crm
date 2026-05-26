import type { Metadata } from 'next';
import Link from 'next/link';
import { GlassCard, SectionTitle } from '@technoprime/ui';
import { notFound, permanentRedirect } from 'next/navigation';
import { fetchShopProductBySlug, fetchShopProducts } from '@/lib/shop-api';
import { ProductGallery } from '@/components/product-gallery';
import { BackButton } from '@/components/back-button';
import { ProductPurchasePanel } from '@/components/product-purchase-panel';
import { ProductViewTracker } from '@/components/product-view-tracker';
import { AlsoBuyCarousel } from '@/components/also-buy-carousel';
import { absoluteUrl, buildPageMetadata } from '@/lib/seo';

function textOf(product: {
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  version?: string | null;
}) {
  return [product.name, product.brand, product.model, product.version]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function detectMemory(product: {
  name?: string | null;
  model?: string | null;
  version?: string | null;
}) {
  const raw = [product.version, product.name, product.model].filter(Boolean).join(' ');
  const match = raw.match(/(\d{3,4})\s?GB/i);
  if (!match) return null;
  return `${match[1]} ГБ`;
}

function detectDisplay(product: {
  name?: string | null;
  model?: string | null;
  version?: string | null;
  brand?: string | null;
}) {
  const text = textOf(product);
  if (text.includes('steam deck oled')) return 'OLED';
  if (text.includes('steam deck lcd')) return 'LCD';
  if (text.includes('playstation portal')) return 'LCD';
  if (text.includes('switch')) return 'LCD';
  return null;
}

function detectDiscSupport(product: {
  name?: string | null;
  model?: string | null;
  version?: string | null;
}) {
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

function normalizeGallery(value: unknown, coverImage?: string | null) {
  let list: string[] = [];
  if (Array.isArray(value)) {
    list = value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
  } else if (typeof value === 'string') {
    const raw = value.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed.filter(
            (item): item is string => typeof item === 'string' && Boolean(item.trim()),
          );
        } else {
          list = [raw];
        }
      } catch {
        list = [raw];
      }
    }
  }

  if (coverImage && !list.includes(coverImage)) {
    list = [coverImage, ...list];
  }

  return Array.from(new Set(list));
}

function buildDescription(product: {
  description?: string | null;
}) {
  return String(product.description || '').trim();
}

function buildSeoTitle(product: {
  name: string;
  seoTitle?: string | null;
  brand?: string | null;
  model?: string | null;
  version?: string | null;
}) {
  const explicit = String(product.seoTitle || '').trim();
  if (explicit) return explicit;

  const baseParts: string[] = [];
  const seen = new Set<string>();

  for (const part of [product.name, product.brand, product.model, product.version]) {
    const normalized = String(part || '').replace(/\s+/g, ' ').trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    baseParts.push(normalized);
  }

  const base = baseParts.join(' ').trim();

  return `${base || product.name} купить в Москве | TechnoPrime`;
}

function buildSeoDescription(product: {
  name: string;
  seoDescription?: string | null;
  shortDescription?: string | null;
  description?: string | null;
}) {
  const explicit = String(product.seoDescription || '').trim();
  if (explicit) return explicit;

  const fallback = String(product.shortDescription || product.description || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (fallback) return `${product.name}. ${fallback}`.slice(0, 320);
  return `${product.name} в каталоге TechnoPrime: проверка, гарантия и быстрая доставка.`;
}

const TRUST_POINTS = [
  {
    title: 'Проверка перед продажей',
    text: 'Проверяем комплект, состояние и базовую работоспособность перед выдачей или отправкой.',
  },
  {
    title: 'Бронь и честная цена',
    text: 'Цена из карточки уходит в заказ и резервируется вместе с выбранной конфигурацией.',
  },
  {
    title: 'Поддержка после покупки',
    text: 'По заказу и подпискам можно быстро связаться с менеджером через личный кабинет.',
  },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchShopProductBySlug(slug);

  if (!product) {
    return buildPageMetadata({
      title: 'Товар не найден | TechnoPrime',
      description: 'Запрошенная карточка товара недоступна или была удалена.',
      path: `/product/${slug}`,
      noIndex: true,
    });
  }

  const canonicalSlug = product.slug || slug;
  return buildPageMetadata({
    title: buildSeoTitle(product),
    description: buildSeoDescription(product),
    path: `/product/${canonicalSlug}`,
    image: product.coverImage || product.previewImage || null,
    type: 'article',
  });
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await fetchShopProductBySlug(slug);
  if (!product) return notFound();
  if (/^\d+$/.test(slug) && product.slug && product.slug !== slug) {
    permanentRedirect(`/product/${product.slug}`);
  }

  const inStock = Boolean(product.inStock);

  const gallery = normalizeGallery(product.gallery, product.coverImage);
  const memory = detectMemory(product);
  const display = detectDisplay(product);
  const discSupport = detectDiscSupport(product);
  const specs = [
    product.version ? `Версия: ${product.version}` : null,
    product.model ? `Модель: ${product.model}` : null,
    product.brand ? `Бренд: ${product.brand}` : null,
    `Состояние: ${product.condition === 'NEW' ? 'Новое' : 'Б/У'}`,
    memory ? `Объём памяти: ${memory}` : null,
    display ? `Дисплей: ${display}` : null,
    discSupport ? `Дисковод: ${discSupport}` : null,
  ].filter((value): value is string => Boolean(value));
  const bundle = product.shortDescription?.trim() || 'Комплектация уточняется менеджером.';
  const descriptionText = buildDescription(product) || 'Описание товара пока не заполнено.';

  const scopedRelated = await fetchShopProducts({
    storeCategory: product.storeCategory || undefined,
    limit: 12,
  });

  let related = scopedRelated.filter((item) => item.id !== product.id);
  if (related.length < 4) {
    const fallbackRelated = await fetchShopProducts({ limit: 16 });
    const map = new Map<number, (typeof fallbackRelated)[number]>();

    related.forEach((item) => map.set(item.id, item));
    fallbackRelated.forEach((item) => {
      if (item.id !== product.id && !map.has(item.id)) {
        map.set(item.id, item);
      }
    });

    related = Array.from(map.values());
  }
  related = related.slice(0, 4);
  const relatedItems = related.map((item) => ({
    id: item.id,
    slug: item.slug,
    name: item.name,
    price: Number(item.price || 0),
    originalPrice: Number(item.originalPrice || 0) || null,
    meta: [item.brand, item.model, item.version].filter(Boolean).join(' · '),
    previewImage: item.previewImage || item.coverImage || null,
    coverImage: item.coverImage || null,
    inStock: item.inStock ?? null,
    isPromo: Boolean(item.isPromo),
    promoRemainingSec: Number(item.promoRemainingSec || 0),
  }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription || product.description || '',
    image: gallery[0] || product.coverImage || undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    url: absoluteUrl(`/product/${product.slug || slug}`),
    sku: product.adSku || undefined,
    offers: {
      '@type': 'Offer',
      price: Number(product.price || 0),
      priceCurrency: 'RUB',
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: absoluteUrl(`/product/${product.slug || slug}`),
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Главная',
        item: absoluteUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Каталог',
        item: absoluteUrl('/catalog'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.name,
        item: absoluteUrl(`/product/${product.slug || slug}`),
      },
    ],
  };

  return (
    <div className="space-y-10">
      <ProductViewTracker productId={product.id} />
      <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
        <Link href="/" className="hover:text-white transition">Главная</Link>
        <span>/</span>
        <Link href="/catalog" className="hover:text-white transition">Каталог</Link>
        <span>/</span>
        <span className="text-slate-200">{product.name}</span>
      </nav>
      <BackButton
        label="Назад"
        className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white transition"
      />

      <SectionTitle
        eyebrow="Карточка товара"
        title={product.name}
      />
      <GlassCard className="p-8">
        <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
            <ProductGallery name={product.name} images={gallery} />

          <ProductPurchasePanel
            productId={product.id}
            slug={product.slug}
            name={product.name}
            coverImage={product.coverImage || null}
            basePrice={Number(product.price || 0)}
            baseOriginalPrice={Number(product.originalPrice || 0) || null}
            baseIsPromo={Boolean(product.isPromo)}
            basePromoRemainingSec={Number(product.promoRemainingSec || 0)}
            baseInStock={inStock}
            metaText={
              [product.brand, product.model, product.version].filter(Boolean).join(' · ') ||
              'Быстрая доставка, проверка комплекта, гарантия 12 месяцев.'
            }
            bundle={bundle}
            specs={specs}
            variants={product.variants || null}
          />
        </div>
        <div className="mt-8 rounded-3xl border border-cyan-300/20 bg-cyan-400/[0.04] p-6">
          <h4 className="text-lg font-semibold text-white">Описание товара</h4>
          <p className="mt-3 text-sm leading-7 text-slate-200">{descriptionText}</p>
        </div>

        <div className="mt-8 md:hidden">
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TRUST_POINTS.map((item) => (
              <div
                key={item.title}
                className="w-[84%] shrink-0 snap-start rounded-3xl border border-white/10 bg-white/[0.03] p-5"
              >
                <h4 className="text-base font-semibold text-white">{item.title}</h4>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 hidden gap-4 md:grid md:grid-cols-3">
          {TRUST_POINTS.map((item) => (
            <div key={item.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h4 className="text-base font-semibold text-white">{item.title}</h4>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.text}</p>
            </div>
          ))}
        </div>

        {relatedItems.length ? (
          <div className="mt-8 space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div>
              <h4 className="text-lg font-semibold text-white">С этим товаром покупают</h4>
              <p className="mt-1 text-sm text-slate-300">
                Релевантные дополнения к выбранной позиции: аксессуары, подписки и комплекты.
              </p>
            </div>
            <AlsoBuyCarousel items={relatedItems} />
          </div>
        ) : null}
      </GlassCard>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </div>
  );
}
