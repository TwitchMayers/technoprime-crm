'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserMenu from './UserMenu';
import NotificationBell from './NotificationBell';

const nav = [
  { href: '/dashboard', label: 'Дашборд' },
  { href: '/clients', label: 'Клиенты' },
  { href: '/products', label: 'Товары' },
  { href: '/orders/new', label: 'Новый заказ' },
  { href: '/tasks', label: 'Задачи' },
  { href: '/subscriptions', label: 'Подписки' },
];

export default function TopNav() {
  const p = usePathname();
  return (
    <header className="sticky top-0 z-40">
      <div className="backdrop-blur-md bg-black/20 border-b border-white/10">
        <div className="container-xxl h-14 flex items-center justify-between">
          <Link href="/dashboard" className="font-bold tracking-wide text-slate-100">
            TechnoPrime System
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm transition ${
                  p?.startsWith(item.href)
                    ? 'bg-white/10 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
                <NotificationBell />
                <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}