'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@technoprime/ui';
import { Logo } from '@/components/logo';
import { CartBadge } from '@/components/cart-badge';

const NAV_ITEMS = [
  { href: '/', label: 'Главная' },
  { href: '/catalog', label: 'Каталог' },
  { href: '/promotions', label: 'Акции' },
  { href: '/delivery', label: 'Доставка' },
  { href: '/warranty', label: 'Гарантия' },
  { href: '/about', label: 'О нас' },
  { href: '/contacts', label: 'Контакты' },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="relative z-20 border-b border-white/10 bg-black/20 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <Logo />
          <nav className="hidden items-center gap-3 text-[0.96rem] font-semibold leading-none text-slate-200 xl:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-2.5 py-1 transition hover:text-white ${
                  pathname === item.href ? 'text-white' : ''
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <CartBadge />
            <Link href="/account">
              <Button
                size="sm"
                className="bg-gradient-to-r from-cyan-300 to-sky-300 px-3 text-slate-950 hover:brightness-105 sm:px-4"
              >
                Кабинет
              </Button>
            </Link>
          </div>
        </div>

        <nav className="mt-3 hidden items-center gap-2 overflow-x-auto pb-1 text-sm font-semibold text-slate-200 md:flex xl:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 transition ${
                pathname === item.href
                  ? 'border-cyan-200/70 bg-cyan-500/15 text-white'
                  : 'border-white/15 bg-white/5 text-slate-200 hover:border-white/30 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
