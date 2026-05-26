'use client';

import { useEffect } from 'react';

const RUNTIME_RECOVERY_KEY = 'crm-runtime-recovery:v1';

function shouldRecoverRuntimeError(message: string) {
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|dynamically imported module|Failed to find Server Action/i.test(
    message,
  );
}

export default function PwaBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const recoverRuntime = async () => {
      if (sessionStorage.getItem(RUNTIME_RECOVERY_KEY) === '1') return;
      sessionStorage.setItem(RUNTIME_RECOVERY_KEY, '1');

      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));
      } catch {
        // ignore
      }

      window.location.reload();
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason instanceof Error ? event.reason.message : String(event.reason || '');
      if (shouldRecoverRuntimeError(message)) {
        void recoverRuntime();
      }
    };

    const onError = (event: ErrorEvent) => {
      const message = event.error instanceof Error ? event.error.message : event.message || '';
      if (shouldRecoverRuntimeError(String(message))) {
        void recoverRuntime();
      }
    };

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.update().catch(() => undefined);
    }).catch((error) => {
      console.error('PWA service worker registration failed', error);
    });

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onError);

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onError);
    };
  }, []);

  return null;
}
