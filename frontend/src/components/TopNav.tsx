'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';

const tabs = [
  { href: '/dashboard',       label: 'Дашборд' },
  { href: '/clients',         label: 'Клиенты' },
  { href: '/products',        label: 'Товары' },
  { href: '/orders',          label: 'Заказы' },
  { href: '/orders/new',      label: 'Новый заказ' },
  { href: '/tasks',           label: 'Задачи' },
  { href: '/subscriptions',   label: 'Подписки' },
];

export default function TopNav() {
  const pathname = usePathname();
  return (
    <div className="sticky top-0 z-30 bg-black/40 backdrop-blur border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
        <div className="font-semibold">TechnoPrime System</div>
        <nav className="flex gap-2">
          {tabs.map((t) => {
            const active = pathname?.startsWith(t.href);
            return (
              <Link
                href={t.href}
                key={t.href}
                className={`px-3 py-1.5 rounded-md text-sm ${active ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </div>
  );
}