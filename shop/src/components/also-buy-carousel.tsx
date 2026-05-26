'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@technoprime/lib';
import { Badge, Button, GlassCard } from '@technoprime/ui';

export type AlsoBuyItem = {
  id: number;
  slug?: string | null;
  name: string;
  price: number;
  originalPrice?: number | null;
  meta?: string;
  previewImage?: string | null;
  coverImage?: string | null;
  inStock?: boolean | null;
  isPromo?: boolean;
  promoRemainingSec?: number;
};

function resolveHref(item: AlsoBuyItem) {
  return item.slug ? `/product/${item.slug}` : `/product/${item.id}`;
}

export function AlsoBuyCarousel({ items }: { items: AlsoBuyItem[] }) {
  const feed = useMemo(() => items.slice(0, 8), [items]);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const desktopTrackRef = useRef<HTMLDivElement | null>(null);

  const canSlide = feed.length > 1;
  const canDesktopScroll = feed.length > 3;

  useEffect(() => {
    if (!canSlide) return undefined;
    const timerId = window.setInterval(() => {
      setIndex((current) => (current + 1) % feed.length);
    }, 5200);
    return () => window.clearInterval(timerId);
  }, [canSlide, feed.length]);

  useEffect(() => {
    if (index >= feed.length) {
      setIndex(0);
    }
  }, [feed.length, index]);

  const scrollDesktop = (direction: 'prev' | 'next') => {
    const node = desktopTrackRef.current;
    if (!node) return;
    const cardWidth = 292;
    node.scrollBy({
      left: direction === 'next' ? cardWidth : -cardWidth,
      behavior: 'smooth',
    });
  };

  if (!feed.length) return null;

  return (
    <section className="space-y-3">
      <div
        className="overflow-hidden rounded-3xl md:hidden"
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
            const imageUrl = item.previewImage || item.coverImage || null;
            return (
              <article key={item.id} className="w-full shrink-0 px-[1px]">
                <GlassCard className="overflow-hidden border-cyan-200/20">
                  <Link href={resolveHref(item)} className="block">
                    <div className="relative h-40 border-b border-white/10 bg-gradient-to-br from-white/10 to-white/5">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={item.name}
                          className="object-cover object-center"
                          fill
                          sizes="(max-width: 768px) 100vw, 272px"
                          quality={70}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/30 to-blue-500/25" />
                      )}
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="space-y-1.5">
                        <p className="text-base font-semibold leading-6 text-white">{item.name}</p>
                        {item.meta ? <p className="text-xs text-slate-400">{item.meta}</p> : null}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          {item.isPromo && item.originalPrice && item.originalPrice > item.price ? (
                            <p className="text-xs text-slate-400 line-through">
                              {formatPrice(item.originalPrice, 'RUB')}
                            </p>
                          ) : null}
                          <p className="text-lg font-semibold text-white">{formatPrice(item.price, 'RUB')}</p>
                        </div>
                        <Badge className={item.inStock === false ? 'bg-white/10 text-slate-300' : ''}>
                          {item.isPromo ? 'Акция' : item.inStock === false ? 'Под заказ' : 'В наличии'}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                </GlassCard>
              </article>
            );
          })}
        </div>
      </div>

      {canSlide ? (
        <div className="flex items-center justify-center gap-1.5 md:hidden">
          {feed.map((item, dotIndex) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(dotIndex)}
              className={`h-2 rounded-full transition-all ${
                dotIndex === index ? 'w-6 bg-cyan-300' : 'w-2 bg-white/30 hover:bg-white/45'
              }`}
              aria-label={`Слайд ${dotIndex + 1}`}
            />
          ))}
        </div>
      ) : null}

      <div className="relative hidden md:block">
        {canDesktopScroll ? (
          <button
            type="button"
            aria-label="Назад"
            onClick={() => scrollDesktop('prev')}
            className="absolute -left-2 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/85 text-slate-200 transition hover:bg-slate-900"
          >
            ‹
          </button>
        ) : null}

        <div
          ref={desktopTrackRef}
          className="scrollbar-hide overflow-x-auto"
        >
          <div className="flex min-w-max gap-4 pb-1 pt-0.5">
            {feed.map((item) => {
              const imageUrl = item.previewImage || item.coverImage || null;
              return (
                <article key={item.id} className="w-[272px] shrink-0">
                  <GlassCard className="h-full overflow-hidden border-cyan-200/20">
                    <Link href={resolveHref(item)} className="block h-full">
                      <div className="relative h-36 border-b border-white/10 bg-gradient-to-br from-white/10 to-white/5">
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={item.name}
                            className="object-cover object-center"
                            fill
                            sizes="272px"
                            quality={70}
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/30 to-blue-500/25" />
                        )}
                      </div>
                      <div className="space-y-2.5 p-4">
                        <p className="text-sm font-semibold leading-5 text-white">{item.name}</p>
                        {item.meta ? <p className="text-xs text-slate-400">{item.meta}</p> : null}
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            {item.isPromo && item.originalPrice && item.originalPrice > item.price ? (
                              <p className="text-[11px] text-slate-400 line-through">
                                {formatPrice(item.originalPrice, 'RUB')}
                              </p>
                            ) : null}
                            <p className="text-base font-semibold text-white">{formatPrice(item.price, 'RUB')}</p>
                          </div>
                          <span className="text-xs text-slate-300">
                            {item.isPromo ? 'Акция' : item.inStock === false ? 'Под заказ' : 'В наличии'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </GlassCard>
                </article>
              );
            })}
          </div>
        </div>

        {canDesktopScroll ? (
          <button
            type="button"
            aria-label="Вперёд"
            onClick={() => scrollDesktop('next')}
            className="absolute -right-2 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/85 text-slate-200 transition hover:bg-slate-900"
          >
            ›
          </button>
        ) : null}
      </div>

      <div className="pt-1 md:hidden">
        <Link href="/catalog" className="block">
          <Button variant="secondary" size="sm" className="w-full justify-center">
            Смотреть весь каталог
          </Button>
        </Link>
      </div>
    </section>
  );
}
