'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCartStore } from '@/lib/cart-store';

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CatalogIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PromoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
      <path d="M4.5 13.2V10.8c0-.5.3-.9.8-1.1l10.7-4.2c.7-.3 1.5.2 1.5 1v11c0 .8-.8 1.3-1.5 1l-10.7-4.2c-.5-.2-.8-.6-.8-1.1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 14.8v3.2c0 .6.4 1 1 1h1.2c.6 0 1-.4 1-1v-2.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
      <path d="M4.3 5.2h1.8c.5 0 .9.3 1 .8l.3 1.5m0 0h10.4a1.1 1.1 0 0 1 1.1 1.3l-.6 4.3a1.1 1.1 0 0 1-1.1.9H9a1 1 0 0 1-1-.8L7.4 7.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9.8" cy="18.6" r="1.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.6" cy="18.6" r="1.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
      <circle cx="12" cy="8.2" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 19.2c.7-3 3.3-4.8 7-4.8s6.3 1.8 7 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const TAB_ITEMS = [
  { href: '/', label: 'Главная', text: 'Главная', icon: HomeIcon },
  { href: '/catalog', label: 'Каталог', text: 'Каталог', icon: CatalogIcon },
  { href: '/promotions', label: 'Акции', text: 'Акции', icon: PromoIcon },
  { href: '/cart', label: 'Корзина', text: 'Корзина', icon: CartIcon },
  { href: '/account', label: 'Личный кабинет', text: 'Кабинет', icon: AccountIcon },
];

export function MobileTabbar() {
  const pathname = usePathname();
  const { totalQty } = useCartStore();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[80] border-t border-white/10 bg-slate-950/94 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-2xl grid-cols-5 gap-0.5">
        {TAB_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const isCart = item.href === '/cart';
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-11 flex-col items-center justify-center rounded-xl px-0.5 text-[10px] font-medium transition ${
                active
                  ? 'bg-cyan-400/15 text-cyan-100'
                  : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
              }`}
              aria-label={item.label}
            >
              <span className={`relative mb-0.5 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full ${active ? 'bg-cyan-300/20 text-cyan-100' : 'text-slate-300'}`}>
                <Icon />
                {isCart && totalQty > 0 ? (
                  <span className="absolute -right-2 -top-2 inline-flex min-w-4 items-center justify-center rounded-full bg-cyan-300 px-1 py-[1px] text-[9px] font-semibold text-slate-900">
                    {totalQty > 99 ? '99+' : totalQty}
                  </span>
                ) : null}
              </span>
              <span>{item.text}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
