'use client';

import { useEffect, useRef, useState } from 'react';
import { ProductCard } from '@/components/product-card';
import type { CatalogProduct } from '@/components/section-catalog';

export function MobileCatalogCarousel({ products }: { products: CatalogProduct[] }) {
  const feed = products.slice(0, 3);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);

  const canSlide = feed.length > 1;

  useEffect(() => {
    if (!canSlide) return undefined;

    const intervalId = window.setInterval(() => {
      setIndex((current) => (current + 1) % feed.length);
    }, 4800);

    return () => window.clearInterval(intervalId);
  }, [canSlide, feed.length]);

  useEffect(() => {
    if (index >= feed.length) {
      setIndex(0);
    }
  }, [feed.length, index]);

  const toPrev = () => {
    if (!canSlide) return;
    setIndex((current) => (current - 1 + feed.length) % feed.length);
  };

  const toNext = () => {
    if (!canSlide) return;
    setIndex((current) => (current + 1) % feed.length);
  };

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
            toNext();
          } else if (touchDeltaX.current >= 48) {
            toPrev();
          }
          touchStartX.current = null;
          touchDeltaX.current = 0;
        }}
      >
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
        >
          {feed.map((product) => (
            <div key={product.id} className="w-full shrink-0 px-[1px]">
              <ProductCard {...product} />
            </div>
          ))}
        </div>
      </div>

      {canSlide ? (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={toPrev}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-slate-200 transition hover:bg-white/10"
            aria-label="Предыдущий товар"
          >
            ‹
          </button>
          <div className="flex items-center gap-1.5">
            {feed.map((product, dotIndex) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setIndex(dotIndex)}
                className={`h-2 rounded-full transition-all ${
                  dotIndex === index ? 'w-6 bg-cyan-300' : 'w-2 bg-white/30 hover:bg-white/45'
                }`}
                aria-label={`Слайд ${dotIndex + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={toNext}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-slate-200 transition hover:bg-white/10"
            aria-label="Следующий товар"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
