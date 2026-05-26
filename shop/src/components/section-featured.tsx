import { GlassCard, SectionTitle, Badge } from '@technoprime/ui';
import { formatPrice } from '@technoprime/lib';
import type { ShopFeatured } from '@/lib/shop-api';
import { MobileFeaturedCarousel } from '@/components/mobile-featured-carousel';
import { PromoCountdown } from '@/components/promo-countdown';

function getFeaturedPrice(item: ShopFeatured) {
  if (item.isPromo && item.promoPrice) {
    const oldPriceSource = item.promoOldPrice || item.priceOverride || item.product?.price || null;
    return {
      isPromo: true,
      price: Number(item.promoPrice),
      oldPrice: oldPriceSource ? Number(oldPriceSource) : null,
      remainingSec: Number(item.promoRemainingSec || 0),
    };
  }

  return {
    isPromo: false,
    price: Number(item.priceOverride || item.product?.price || 0),
    oldPrice: null,
    remainingSec: 0,
  };
}

export function FeaturedSection({ items }: { items: ShopFeatured[] }) {
  if (!items.length) return null;

  const feed = items.filter((item) => item.isPromo).slice(0, 3);
  if (!feed.length) return null;

  const columnsClass =
    feed.length === 1
      ? 'md:grid-cols-1 max-w-3xl'
      : feed.length === 2
        ? 'md:grid-cols-2 max-w-5xl'
        : 'md:grid-cols-3';

  return (
    <section className="mt-12 space-y-6 md:space-y-8" id="featured">
      <SectionTitle
        eyebrow="Акции"
        title="Актуальные предложения TechnoPrime"
        subtitle="Показываем только запущенные акции с таймером до завершения."
      />
      <MobileFeaturedCarousel items={feed} />

      <div className={`mx-auto hidden gap-6 md:grid ${columnsClass}`}>
        {feed.map((item) => {
          const price = getFeaturedPrice(item);
          return (
            <GlassCard key={item.id} className="relative flex h-full flex-col gap-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <Badge>{item.badge || 'Акция'}</Badge>
                {price.remainingSec > 0 ? (
                  <PromoCountdown
                    initialSeconds={price.remainingSec}
                    className="text-xs text-cyan-200/80"
                  />
                ) : (
                  <span className="text-xs text-cyan-200/70">TechnoPrime</span>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                {item.subtitle ? <p className="text-sm text-slate-300">{item.subtitle}</p> : null}
              </div>

              <div className="mt-auto flex items-end justify-between gap-3">
                <div className="space-y-1">
                  {price.oldPrice && price.oldPrice > price.price ? (
                    <div className="text-sm text-slate-400 line-through">
                      {formatPrice(price.oldPrice)}
                    </div>
                  ) : null}
                  <span className="text-xl font-semibold">{formatPrice(price.price)}</span>
                </div>

                <span className="text-xs text-slate-400 text-right">
                  {item.product?.name || (item.kit?.name ? `Комплект: ${item.kit.name}` : 'Комплектация')}
                </span>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </section>
  );
}
