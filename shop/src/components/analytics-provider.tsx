'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import {
  analyticsEnabled,
  GA_MEASUREMENT_ID,
  trackEvent,
  trackPageView,
  YANDEX_METRIKA_ID,
} from '@/lib/analytics';

export function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    if (!analyticsEnabled()) return;
    const query = typeof window !== 'undefined' ? window.location.search : '';
    const url = query ? `${pathname}${query}` : pathname || '/';
    trackPageView(url, typeof document !== 'undefined' ? document.title : undefined);
  }, [pathname]);

  useEffect(() => {
    if (!analyticsEnabled()) return;

    const handleClick = (event: MouseEvent) => {
      const element = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-analytics-click]');
      if (!element) return;

      const label = element.dataset.analyticsClick || 'button_click';
      const location = element.dataset.analyticsLocation || pathname || '/';
      const product = element.dataset.analyticsProduct || undefined;

      trackEvent('button_click', {
        label,
        location,
        product,
      });
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [pathname]);

  return (
    <>
      {GA_MEASUREMENT_ID ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
            `}
          </Script>
        </>
      ) : null}

      {YANDEX_METRIKA_ID ? (
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {
                if (document.scripts[j].src === r) return;
              }
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a);
            })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
            ym(${YANDEX_METRIKA_ID}, 'init', {
              clickmap:true,
              trackLinks:true,
              accurateTrackBounce:true,
              webvisor:true
            });
          `}
        </Script>
      ) : null}
    </>
  );
}
