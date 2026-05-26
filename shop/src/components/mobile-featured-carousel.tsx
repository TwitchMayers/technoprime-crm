'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge, GlassCard } from '@technoprime/ui';
import { formatPrice } from '@technoprime/lib';
import type { ShopFeatured } from '@/lib/shop-api';
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

export function MobileFeaturedCarousel({ items }: { items: ShopFeatured[] }) {
  const feed = items.filter((item) => item.isPromo).slice(0, 3);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const canSlide = feed.length > 1;

  useEffect(() => {
    if (!canSlide) return undefined;
    const intervalId = window.setInterval(() => {
      setIndex((current) => (current + 1) % feed.length);
    }, 5200);
    return () => window.clearInterval(intervalId);
  }, [canSlide, feed.length]);

  if (!feed.length) return null;

  return (
    <div className="md:hidden space-y-3">
      <div
        className="overflow-hidden rounded-3xl"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
          touchDeltaX.current = 0;
        }}
        onTouchMove={(event) => {
          if (touchStartX.current === null) return;
          touchDeltaX.current = (event.touches[0]?.clientX ?? 0) - touchStartX.current;
        }}
        onTouchEnd={() => {
          if (!canSlide) return;
          if (touchDeltaX.current <= -48) {
            setIndex((current) => (current + 1) % feed.length);
          } else if (touchDeltaX.current >= 48) {
            setIndex((current) => (current - 1 + feed.length) % feed.length);
          }
          touchStartX.current = null;
          touchDeltaX.current = 0;
        }}
      >
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translate3d(-${index * 100}%,0,0)` }}
        >
          {feed.map((item) => {
            const price = getFeaturedPrice(item);
            return (
              <div key={item.id} className="w-full shrink-0 px-[1px]">
                <GlassCard className="relative flex h-full flex-col gap-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <Badge>{item.badge || 'Акция'}</Badge>
                    {price.remainingSec > 0 ? (
                      <PromoCountdown
                        initialSeconds={price.remainingSec}
                        className="text-xs text-cyan-200/80"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    {item.subtitle ? <p className="text-sm text-slate-300">{item.subtitle}</p> : null}
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-3">
                    <div className="space-y-1">
                      {price.oldPrice && price.oldPrice > price.price ? (
                        <div className="text-sm text-slate-400 line-through">{formatPrice(price.oldPrice)}</div>
                      ) : null}
                      <span className="text-xl font-semibold">{formatPrice(price.price)}</span>
                    </div>
                    <span className="text-right text-xs text-slate-400">
                      {item.product?.name || (item.kit?.name ? `Комплект: ${item.kit.name}` : 'Комплектация')}
                    </span>
                  </div>
                </GlassCard>
              </div>
            );
          })}
        </div>
      </div>

      {canSlide ? (
        <div className="flex items-center justify-center gap-1.5">
          {feed.map((item, dotIndex) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(dotIndex)}
              className={`h-2 rounded-full transition-all ${
                dotIndex === index ? 'w-6 bg-cyan-300' : 'w-2 bg-white/30 hover:bg-white/45'
              }`}
              aria-label={`Акция ${dotIndex + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
