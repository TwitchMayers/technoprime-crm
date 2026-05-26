'use client';

import Link from 'next/link';
import { useCartStore } from '@/lib/cart-store';

export function CartBadge() {
  const { totalQty } = useCartStore();

  return (
    <Link
      href="/cart"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-cyan-200/50 bg-cyan-500/15 text-cyan-100 transition hover:bg-cyan-500/25"
      aria-label="Корзина"
      title="Корзина"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path
          d="M4 5h1.6c.6 0 1.1.4 1.2 1l.3 1.5m0 0h11.2c.8 0 1.4.7 1.3 1.5l-.7 5.2c-.1.7-.6 1.1-1.3 1.1H9.1c-.6 0-1.1-.4-1.2-1L7.1 7.5Zm2.4 11.8a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Zm8 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {totalQty > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-cyan-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-900">
          {totalQty}
        </span>
      ) : null}
    </Link>
  );
}
