declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    ym?: (counterId: number, method: string, ...args: unknown[]) => void;
  }
}

export const GA_MEASUREMENT_ID = String(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '').trim();
export const YANDEX_METRIKA_ID = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || 0) || 0;

function normalizeGoalName(name: string) {
  const normalized = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'custom_event';
}

export function analyticsEnabled() {
  return Boolean(GA_MEASUREMENT_ID || YANDEX_METRIKA_ID);
}

export function trackPageView(url: string, title?: string) {
  if (typeof window === 'undefined') return;

  if (GA_MEASUREMENT_ID && typeof window.gtag === 'function') {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
      page_title: title || document.title,
    });
  }

  if (YANDEX_METRIKA_ID && typeof window.ym === 'function') {
    window.ym(YANDEX_METRIKA_ID, 'hit', url, {
      title: title || document.title,
    });
  }
}

export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean | null | undefined>,
) {
  if (typeof window === 'undefined') return;

  if (GA_MEASUREMENT_ID && typeof window.gtag === 'function') {
    window.gtag('event', name, params || {});
  }

  if (YANDEX_METRIKA_ID && typeof window.ym === 'function') {
    window.ym(YANDEX_METRIKA_ID, 'reachGoal', normalizeGoalName(name), params || {});
  }
}
