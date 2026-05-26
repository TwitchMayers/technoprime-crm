'use client';

import { useEffect, useState } from 'react';

function isIosFamily() {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  const isTouchMac = platform === 'macintel' && navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/.test(userAgent) || isTouchMac;
}

function computePageActive() {
  if (typeof document === 'undefined') return true;

  const visible = !document.hidden;
  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  const focused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;

  // Mobile Safari can report document.hasFocus() = false even when the app is
  // visibly open, which breaks live polling and notifications in the CRM.
  if (isIosFamily()) {
    return visible && online;
  }

  return visible && focused && online;
}

export function usePageActivity() {
  const [isPageActive, setIsPageActive] = useState<boolean>(() => computePageActive());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const sync = () => setIsPageActive(computePageActive());

    sync();

    window.addEventListener('focus', sync);
    window.addEventListener('blur', sync);
    window.addEventListener('pageshow', sync);
    window.addEventListener('pagehide', sync);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    document.addEventListener('visibilitychange', sync);

    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('blur', sync);
      window.removeEventListener('pageshow', sync);
      window.removeEventListener('pagehide', sync);
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return isPageActive;
}

export function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function supportsCrmNotifications() {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;

  // On iPhone/iPad web push is available for Home Screen web apps only.
  if (isIosFamily() && !isStandaloneDisplayMode()) {
    return false;
  }

  return true;
}

export function needsStandaloneInstallForNotifications() {
  return isIosFamily() && !isStandaloneDisplayMode();
}
