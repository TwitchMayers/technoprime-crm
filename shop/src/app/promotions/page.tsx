import Link from 'next/link';
import { GlassCard, SectionTitle } from '@technoprime/ui';
import { formatPrice } from '@technoprime/lib';
import { fetchShopFeatured } from '@/lib/shop-api';
import { buildPageMetadata } from '@/lib/seo';
import { PromoCountdown } from '@/components/promo-countdown';

export const metadata = buildPageMetadata({
  title: 'Акции и спецпредложения | TechnoPrime',
  description:
    'Актуальные акции TechnoPrime на игровые приставки, комплекты и аксессуары с фиксированной выгодой.',
  path: '/promotions',
});

export default async function PromotionsPage() {
  const items = await fetchShopFeatured();
  const promos = items.filter((item) => item.isPromo && item.promoPrice);

  return (
    <div className="space-y-10">
      <SectionTitle
        eyebrow="Акции"
        title="Акционные предложения TechnoPrime"
        subtitle="Только активные предложения с зачёркнутой старой ценой и актуальной стоимостью."
      />

      {promos.length === 0 ? (
        <GlassCard className="p-6">
          <p className="text-sm text-slate-300">
            Активных акций сейчас нет. Загляните позже или перейдите в каталог.
          </p>
          <Link href="/catalog" className="mt-3 inline-block text-cyan-200 hover:text-cyan-100">
            Перейти в каталог
          </Link>
        </GlassCard>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {promos.map((item) => {
            const newPrice = Number(item.promoPrice || 0);
            const oldPrice = Number(item.promoOldPrice || item.priceOverride || item.product?.price || 0);
            return (
              <GlassCard key={item.id} className="p-6 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">Акция</p>
                  <PromoCountdown
                    initialSeconds={item.promoRemainingSec}
                    className="text-xs text-cyan-200/80"
                  />
                </div>
                <h3 className="text-xl font-semibold">{item.title}</h3>
                {item.subtitle ? <p className="text-sm text-slate-300">{item.subtitle}</p> : null}

                <div className="space-y-1">
                  {oldPrice > newPrice ? (
                    <p className="text-sm text-slate-400 line-through">{formatPrice(oldPrice)}</p>
                  ) : null}
                  <p className="text-2xl font-semibold text-white">{formatPrice(newPrice)}</p>
                </div>

                <div className="text-xs text-slate-400">
                  {item.product ? (
                    <Link
                      href={item.product.id ? `/product/${item.product.id}` : '/catalog'}
                      className="hover:text-cyan-200"
                    >
                      {item.promoVariantLabel
                        ? `${item.product.name} · ${item.promoVariantLabel}`
                        : item.product.name}
                    </Link>
                  ) : item.kit?.name ? (
                    `Комплект: ${item.kit.name}`
                  ) : (
                    'Спецпредложение'
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
