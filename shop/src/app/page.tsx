import { Hero } from '@/components/hero';
import { CatalogSection, CatalogProduct } from '@/components/section-catalog';
import { FeaturedSection } from '@/components/section-featured';
import { CtaSection } from '@/components/section-cta';
import { featuredProducts } from '@/data/catalog';
import { fetchShopFeatured, fetchShopProducts, fetchTopViewedProducts, ShopProduct } from '@/lib/shop-api';
import { Button } from '@technoprime/ui';
import Link from 'next/link';
import { ConsultationDialog } from '@/components/consultation-dialog';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Игровые приставки и готовые комплекты купить в Москве | TechnoPrime',
  description:
    'Каталог TechnoPrime: PlayStation, Xbox, Steam Deck, аксессуары и готовые игровые решения с гарантией и доставкой.',
  path: '/',
});

function isConsoleStoreProduct(item: ShopProduct) {
  const category = String(item.category || '').toUpperCase();
  const storeCategory = String(item.storeCategory || '').toUpperCase();
  return (
    category === 'CONSOLE' ||
    storeCategory === 'HOME_CONSOLES' ||
    storeCategory === 'PORTABLE_CONSOLES'
  );
}

function toCatalogProduct(item: ShopProduct): CatalogProduct {
  const defaultVariant = Array.isArray(item.variants)
    ? item.variants.find((variant) => variant.isDefault) || item.variants[0]
    : null;
  const currentPrice = Number(defaultVariant?.price ?? item.price ?? 0);
  const originalPrice = Number(defaultVariant?.promoOldPrice ?? defaultVariant?.originalPrice ?? item.originalPrice ?? 0);

  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    price: currentPrice,
    originalPrice: originalPrice > currentPrice ? originalPrice : null,
    badge: item.inStock ? 'В наличии' : 'Под заказ',
    meta: [item.brand, item.model, item.version].filter(Boolean).join(' · '),
    coverImage: item.coverImage || null,
    previewImage: item.previewImage || item.coverImage || null,
    inStock: item.inStock ?? null,
    isPromo: Boolean(defaultVariant?.isPromo || item.isPromo),
    promoRemainingSec: Number(defaultVariant?.promoRemainingSec ?? item.promoRemainingSec ?? 0),
    variantKey: defaultVariant?.key || null,
    variantLabel: defaultVariant?.label || null,
  };
}

export default async function HomePage() {
  const [apiProducts, featured, topViewedProducts, homeConsoles, portableConsoles] = await Promise.all([
    fetchShopProducts({ limit: 12 }),
    fetchShopFeatured(),
    fetchTopViewedProducts(3, 30),
    fetchShopProducts({ storeCategory: 'HOME_CONSOLES', limit: 1 }),
    fetchShopProducts({ storeCategory: 'PORTABLE_CONSOLES', limit: 1 }),
  ]);
  const catalog: CatalogProduct[] = apiProducts.length
    ? apiProducts.map((item) => toCatalogProduct(item))
    : featuredProducts.map((item, idx) => ({
        ...item,
        id: Number(String(item.id).replace(/\D/g, '')) || idx + 1,
      }));
  const popularProducts = topViewedProducts.length
    ? topViewedProducts.map((item) => toCatalogProduct(item)).slice(0, 3)
    : catalog.slice(0, 3);

  const latestConsoleCandidates = [homeConsoles[0], portableConsoles[0]]
    .filter((item): item is ShopProduct => Boolean(item))
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  const latestProduct =
    latestConsoleCandidates[0] ||
    apiProducts.find(item => isConsoleStoreProduct(item)) ||
    apiProducts[0];
  const latestVariant = Array.isArray(latestProduct?.variants)
    ? latestProduct?.variants.find((variant) => variant.isDefault) || latestProduct?.variants[0]
    : null;
  const latestPrice = Number(latestVariant?.price ?? latestProduct?.price ?? 0);
  const latestHref =
    latestProduct?.slug && String(latestProduct.slug).trim()
      ? `/product/${latestProduct.slug}`
      : latestProduct?.id
        ? `/product/${latestProduct.id}`
        : '/catalog';
  const latestDescription =
    String(latestProduct?.shortDescription || latestProduct?.description || '').trim() ||
    'Свежая поставка: проверка перед оплатой и официальная гарантия.';
  const latestImage = latestProduct?.previewImage || latestProduct?.coverImage || null;

  return (
    <div className="space-y-4 sm:space-y-5">
      <ConsultationDialog
        variant="secondary"
        size="sm"
        label="Чат"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-3 z-[90] min-h-10 rounded-full border border-cyan-200/35 bg-slate-900/86 px-3 text-sm font-semibold text-cyan-100 shadow-[0_10px_22px_rgba(6,182,212,0.28)] backdrop-blur-xl md:hidden"
      />
      <Hero
        freshDrop={{
          title: latestProduct?.name || 'PlayStation 5 + Premium комплект',
          description: latestDescription,
          price: latestPrice > 0 ? latestPrice : 45990,
          href: latestHref,
          imageUrl: latestImage,
          imageAlt: latestProduct?.name || 'Новая поставка TechnoPrime',
        }}
      />
      <FeaturedSection items={featured} />
      <CatalogSection products={popularProducts} />
      <div className="flex justify-center">
        <Link href="/catalog">
          <Button size="lg">Открыть полный каталог</Button>
        </Link>
      </div>
      <CtaSection />
    </div>
  );
}
