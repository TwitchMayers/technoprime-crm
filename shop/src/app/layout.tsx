import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import './globals.css';
import { cn } from '@technoprime/lib';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { MobileTabbar } from '@/components/mobile-tabbar';
import { AnalyticsProvider } from '@/components/analytics-provider';
import { buildOgImageUrl, SITE_NAME, SITE_URL } from '@/lib/seo';

const localFontVariables: CSSProperties = {
  ['--font-body' as string]:
    '"Segoe UI", "SF Pro Text", "Inter", -apple-system, BlinkMacSystemFont, "Roboto", sans-serif',
  ['--font-display' as string]:
    '"Segoe UI", "SF Pro Display", "Inter", -apple-system, BlinkMacSystemFont, "Roboto", sans-serif',
};

export const metadata: Metadata = {
  title: SITE_NAME,
  description:
    'TechnoPrime Store: игровые приставки, аксессуары, готовые комплекты, доставка и гарантия.',
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: [{ url: '/favicon-tp.ico?v=3' }, { url: '/brand/favicon-tp.png?v=3' }],
    shortcut: '/favicon-tp.ico?v=3',
    apple: '/brand/favicon-tp.png?v=3',
  },
  openGraph: {
    title: SITE_NAME,
    description: 'Игровые приставки, готовые комплекты и поддержка от TechnoPrime.',
    type: 'website',
    locale: 'ru_RU',
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [
      {
        url: buildOgImageUrl(SITE_NAME, 'Игровые приставки, комплекты и аксессуары'),
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: 'Игровые приставки, готовые комплекты и поддержка от TechnoPrime.',
    images: [buildOgImageUrl(SITE_NAME, 'Игровые приставки, комплекты и аксессуары')],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'TechnoPrime',
    url: 'https://technoprimestore.ru',
    sameAs: ['https://t.me/technoprime'],
  };

  return (
    <html lang="ru">
      <body className={cn('font-body text-white')} style={localFontVariables}>
        <AnalyticsProvider />
        <div className="relative min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute inset-0 grid-glow" />
          <SiteHeader />

          <main className="relative z-10 mx-auto w-full max-w-7xl px-3 pb-[max(6.5rem,env(safe-area-inset-bottom)+5.4rem)] pt-4 sm:px-4 sm:pt-5 md:px-8 md:pb-20 md:pt-8">
            {children}
          </main>

          <SiteFooter />
          <MobileTabbar />
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </body>
    </html>
  );
}
