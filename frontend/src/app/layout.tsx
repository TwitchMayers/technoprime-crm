'use client';

import type { ReactNode } from 'react';
import './globals.css';
import Providers from './providers';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <head>
        <style>{`
          * {
            scrollbar-width: thin;
            scrollbar-color: rgba(148, 163, 184, 0.3) rgba(30, 27, 75, 1);
          }
          *::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          *::-webkit-scrollbar-track {
            background: rgba(30, 27, 75, 1);
          }
          *::-webkit-scrollbar-thumb {
            background: rgba(148, 163, 184, 0.3);
            border-radius: 3px;
          }
          *::-webkit-scrollbar-thumb:hover {
            background: rgba(148, 163, 184, 0.5);
          }
        `}</style>
      </head>

      <body className="min-h-screen text-white overflow-hidden bg-slate-900">
        {/* ❗️ВАЖНО: AuthProvider ТОЛЬКО В Providers */}
        <Providers>
          <LayoutWrapper>{children}</LayoutWrapper>
        </Providers>
      </body>
    </html>
  );
}

/* ===================== */
/*  LayoutWrapper        */
/* ===================== */

function LayoutWrapper({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  const isPublicPage = pathname === '/login' || pathname === '/register';

  // 🔹 Публичные страницы — без layout
  if (isPublicPage) {
    return <>{children}</>;
  }

  // 🔹 Пока AuthContext инициализируется — ничего не рендерим
  if (loading) {
    return null;
  }

  // 🔹 Неавторизован — AuthContext сам редиректит
  if (!user) {
    return null;
  }

  // 🔹 Авторизован — полноценный layout
  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      {/* Sidebar (desktop) */}
      <div className="hidden md:block relative z-20">
        <Sidebar />
      </div>

      {/* Mobile navigation */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50">
        <MobileNav />
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden pt-20 md:pt-0">
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-6 py-4 md:py-6 max-w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
