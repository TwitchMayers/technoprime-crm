import Link from 'next/link';
import { Button, GlassCard, SectionTitle } from '@technoprime/ui';
import { ProductCard } from '@/components/product-card';
import type { ShopProduct } from '@/lib/shop-api';
import type { StorefrontLandingConfig } from '@/lib/storefront-landings';
import { absoluteUrl } from '@/lib/seo';

function toCard(product: ShopProduct) {
  const defaultVariant = Array.isArray(product.variants)
    ? product.variants.find((variant) => variant.isDefault) || product.variants[0]
    : null;
  const currentPrice = Number(defaultVariant?.price ?? product.price ?? 0);
  const originalPrice = Number(
    defaultVariant?.promoOldPrice ?? defaultVariant?.originalPrice ?? product.originalPrice ?? 0,
  );

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: currentPrice,
    originalPrice: originalPrice > currentPrice ? originalPrice : null,
    badge: product.inStock ? 'В наличии' : 'Под заказ',
    meta: [product.brand, product.model, product.version].filter(Boolean).join(' · '),
    summary: product.shortDescription || null,
    coverImage: product.coverImage || null,
    previewImage: product.previewImage || product.coverImage || null,
    inStock: product.inStock ?? null,
    isPromo: Boolean(defaultVariant?.isPromo || product.isPromo),
    promoRemainingSec: Number(defaultVariant?.promoRemainingSec ?? product.promoRemainingSec ?? 0),
    variantKey: defaultVariant?.key || null,
    variantLabel: defaultVariant?.label || null,
  };
}

export function StorefrontLandingPage({
  config,
  products,
}: {
  config: StorefrontLandingConfig;
  products: ShopProduct[];
}) {
  const productCards = products.map(toCard);

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: config.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
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
        name: config.title,
        item: absoluteUrl(`/${config.slug}`),
      },
    ],
  };

  return (
    <div className="space-y-10">
      <SectionTitle eyebrow={config.heroEyebrow} title={config.title} subtitle={config.description} />

      <GlassCard className="grid gap-5 p-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div>
          <p className="text-sm leading-7 text-slate-200">{config.intro}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={config.catalogHref}>
              <Button data-analytics-click={`open_${config.slug}_catalog`} data-analytics-location={`landing:${config.slug}`}>
                Смотреть товары
              </Button>
            </Link>
            <Link href="/checkout">
              <Button
                variant="secondary"
                data-analytics-click={`open_${config.slug}_checkout`}
                data-analytics-location={`landing:${config.slug}`}
              >
                Перейти к оформлению
              </Button>
            </Link>
          </div>
        </div>
        <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/10 p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">Почему это удобно</p>
          <ul className="mt-4 space-y-3 text-sm text-slate-200">
            <li>Актуальное наличие и цена обновляются в каталоге без ручных уточнений.</li>
            <li>После оформления заказа бронь и оплата доступны из личного кабинета.</li>
            <li>По заказу и подпискам можно быстро связаться с менеджером.</li>
          </ul>
        </div>
      </GlassCard>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Товары по направлению</h2>
            <p className="mt-2 text-sm text-slate-300">
              Отдельная подборка товаров для трафика по {config.slug.replace('-', ' ')}.
            </p>
          </div>
          <Link href={config.catalogHref} className="text-sm text-cyan-200 hover:text-cyan-100">
            Смотреть все
          </Link>
        </div>

        {productCards.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {productCards.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
        ) : (
          <GlassCard className="p-6 text-sm text-slate-300">
            Сейчас на этой посадочной странице нет активных товаров. Актуальные предложения появятся после синхронизации каталога.
          </GlassCard>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Почему выбирают TechnoPrime</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {config.whyUs.map((item) => (
            <GlassCard key={item.title} className="p-5">
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.text}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">FAQ</h2>
        <div className="grid gap-4">
          {config.faq.map((item) => (
            <GlassCard key={item.question} className="p-5">
              <h3 className="text-lg font-semibold text-white">{item.question}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.answer}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </div>
  );
}
