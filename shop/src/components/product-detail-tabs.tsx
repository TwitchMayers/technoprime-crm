'use client';

import { useMemo, useState } from 'react';

type ProductDetailTabsProps = {
  bundle: string;
  specs: string[];
};

function normalizeBundle(bundle: string) {
  const raw = bundle.replace(/^комплект:\s*/i, '').trim();
  if (!raw) return [];
  return raw
    .split(/[;,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ProductDetailTabs({ bundle, specs }: ProductDetailTabsProps) {
  const [tab, setTab] = useState<'bundle' | 'specs'>('bundle');

  const bundleItems = useMemo(() => normalizeBundle(bundle), [bundle]);
  const preparedSpecs = useMemo(() => specs.filter(Boolean), [specs]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
        <button
          type="button"
          onClick={() => setTab('bundle')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            tab === 'bundle'
              ? 'bg-cyan-400/20 text-cyan-100'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          Комплект
        </button>
        <button
          type="button"
          onClick={() => setTab('specs')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            tab === 'specs'
              ? 'bg-cyan-400/20 text-cyan-100'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          Характеристики
        </button>
      </div>

      {tab === 'bundle' ? (
        <div className="mt-3">
          {bundleItems.length ? (
            <ul className="space-y-1.5 text-sm text-slate-200">
              {bundleItems.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-slate-400">Комплектация уточняется менеджером</div>
          )}
        </div>
      ) : (
        <div className="mt-3">
          {preparedSpecs.length ? (
            <ul className="space-y-1.5 text-sm text-slate-200">
              {preparedSpecs.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-slate-400">Характеристики уточняются менеджером</div>
          )}
        </div>
      )}
    </div>
  );
}
