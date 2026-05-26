'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
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
        <meta name="theme-color" content="#0f172a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TechnoPrime CRM" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-icon" />
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

      <body className="h-[100dvh] overflow-hidden overflow-x-hidden bg-slate-900 text-white">
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
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <div className="text-sm text-slate-400">Проверка сессии...</div>
        </div>
      </div>
    );
  }

  // 🔹 Неавторизован — AuthContext сам редиректит
  if (!user) {
    return <UnauthorizedFallback />;
  }

  // 🔹 Авторизован — полноценный layout
  return (
    <div className="flex h-[100dvh] bg-slate-900 overflow-hidden">
      {/* Sidebar (desktop) */}
      <div className="relative z-20 hidden self-start md:sticky md:top-0 md:block md:h-[100dvh]">
        <Sidebar />
      </div>

      {/* Mobile navigation */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50">
        <MobileNav />
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden pt-[calc(env(safe-area-inset-top)+3.35rem)] md:pt-0">
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2.5 sm:px-4 md:px-6 md:py-6 max-w-full">
          {children}
        </div>
      </main>
    </div>
  );
}

function UnauthorizedFallback() {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace('/login');
      }
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950">
      <div className="text-center">
        <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
        <div className="text-sm text-slate-400">Проверяю доступ и перенаправляю на вход...</div>
      </div>
    </div>
  );
}
