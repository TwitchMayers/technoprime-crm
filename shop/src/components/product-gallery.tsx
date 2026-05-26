'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';

type ProductGalleryProps = {
  name: string;
  images: string[];
};

export function ProductGallery({ name, images }: ProductGalleryProps) {
  const normalized = useMemo(
    () =>
      Array.from(
        new Set(
          images
            .map((url) => (typeof url === 'string' ? url.trim() : ''))
            .filter(Boolean),
        ),
      ),
    [images],
  );

  const [activeIndex, setActiveIndex] = useState(0);

  if (!normalized.length) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 text-sm text-slate-300 md:h-[460px]">
        Фото пока не добавлены
      </div>
    );
  }

  const clampedIndex = Math.min(activeIndex, normalized.length - 1);
  const activeImage = normalized[clampedIndex];
  const canSlide = normalized.length > 1;

  const prev = () => {
    if (!canSlide) return;
    setActiveIndex((current) => (current - 1 + normalized.length) % normalized.length);
  };

  const next = () => {
    if (!canSlide) return;
    setActiveIndex((current) => (current + 1) % normalized.length);
  };

  return (
    <div className="space-y-3">
      <div className="relative h-[360px] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 md:h-[460px]">
        <Image
          src={activeImage}
          alt={name}
          className="object-cover"
          fill
          sizes="(max-width: 1024px) 100vw, 55vw"
          quality={78}
          priority
        />

        {canSlide ? (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Предыдущее фото"
              className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur transition hover:bg-black/60"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Следующее фото"
              className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur transition hover:bg-black/60"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        ) : null}
      </div>

      {canSlide ? (
        <>
          <div className="flex items-center justify-end">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              {clampedIndex + 1} / {normalized.length}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 md:grid-cols-5">
            {normalized.map((url, index) => (
              <button
                key={url}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`overflow-hidden rounded-xl border transition ${
                  clampedIndex === index
                    ? 'border-cyan-300/80 ring-1 ring-cyan-300/60'
                    : 'border-white/10 hover:border-white/30'
                }`}
              >
                <Image
                  src={url}
                  alt={`${name} ${index + 1}`}
                  width={160}
                  height={96}
                  className="h-16 w-full object-cover"
                  sizes="160px"
                  quality={62}
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
