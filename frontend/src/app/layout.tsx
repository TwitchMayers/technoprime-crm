'use client';
import './globals.css';
import Providers from './providers';
import TopNav from '@/components/TopNav';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Providers>
          <TopNav />
          <main className="container-xxl py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}