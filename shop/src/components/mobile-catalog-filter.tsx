'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@technoprime/ui';

type MobileCatalogFilterProps = {
  defaultQuery?: string;
};

export function MobileCatalogFilter({ defaultQuery = '' }: MobileCatalogFilterProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(defaultQuery);

  useEffect(() => {
    setQuery(defaultQuery);
  }, [defaultQuery]);

  useEffect(() => {
    if (!open) return undefined;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [open]);

  const applyFilter = () => {
    const value = query.trim();
    if (!value) {
      router.push('/catalog');
      setOpen(false);
      return;
    }
    const params = new URLSearchParams();
    params.set('q', value);
    router.push(`/catalog?${params.toString()}`);
    setOpen(false);
  };

  const resetFilter = () => {
    setQuery('');
    router.push('/catalog');
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.85rem)] right-3 z-[85] inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full border border-cyan-200/40 bg-slate-950/95 px-3.5 text-sm font-semibold text-cyan-100 shadow-[0_18px_34px_rgba(8,47,73,0.42)] backdrop-blur md:hidden"
        aria-label="Открыть фильтр каталога"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path
            d="M4 6h16l-6 7v4l-4 1v-5L4 6Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>Фильтр</span>
      </button>

      <div
        className={`fixed inset-0 z-[120] bg-slate-950/72 backdrop-blur-sm transition md:hidden ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpen(false)}
      >
        <div
          className={`absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/10 bg-[linear-gradient(180deg,rgba(8,14,28,0.98),rgba(4,10,22,0.98))] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform duration-300 ${
            open ? 'translate-y-0' : 'translate-y-full'
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-cyan-100/85">
              Фильтрация
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-white/20 px-2 text-sm text-slate-200"
              aria-label="Закрыть фильтр"
            >
              ×
            </button>
          </div>

          <div className="space-y-3">
            <label className="space-y-1.5 text-sm">
              <span className="text-slate-300">Поиск по названию, бренду, модели</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Например, PlayStation 5 Slim"
                className="w-full rounded-xl border border-cyan-100/35 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400"
              />
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                size="md"
                className="min-h-12 w-full justify-center"
                onClick={applyFilter}
              >
                Применить
              </Button>
              <Button
                size="md"
                variant="secondary"
                className="min-h-12 w-full justify-center"
                onClick={resetFilter}
              >
                Сбросить
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
