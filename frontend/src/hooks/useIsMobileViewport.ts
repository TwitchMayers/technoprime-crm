'use client';

import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

function readMatch() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia(MOBILE_QUERY).matches;
}

export function useIsMobileViewport() {
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => readMatch());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    const sync = () => setIsMobileViewport(mediaQuery.matches);

    sync();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', sync);
      return () => mediaQuery.removeEventListener('change', sync);
    }

    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

  return isMobileViewport;
}
