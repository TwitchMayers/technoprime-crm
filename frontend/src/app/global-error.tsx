'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

function isChunkLikeError(message: string) {
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|NEXT_REDIRECT/i.test(
    message,
  );
}

async function recoverClientRuntime() {
  if (typeof window === 'undefined') return;

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
    }
  } catch {
    // no-op
  } finally {
    window.location.reload();
  }
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    console.error('Global CRM runtime error', error);
  }, [error]);

  const isRuntimeMismatch = useMemo(
    () => isChunkLikeError(`${error?.message || ''} ${error?.digest || ''}`),
    [error],
  );

  const handleRecovery = async () => {
    setRecovering(true);
    await recoverClientRuntime();
  };

  return (
    <html lang="ru" className="dark">
      <body className="min-h-[100dvh] bg-slate-950 text-white">
        <div className="flex min-h-[100dvh] items-center justify-center px-4 py-[calc(env(safe-area-inset-top)+1.5rem)]">
          <div className="w-full max-w-md rounded-3xl border border-slate-700/70 bg-slate-950/90 p-5 shadow-[0_25px_60px_rgba(2,6,23,0.45)] backdrop-blur-2xl sm:p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-xl font-bold text-white">CRM временно недоступна</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Не удалось загрузить интерфейс. Обычно помогает обновить страницу и очистить старые файлы приложения.
            </p>

            <div className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-900/70 px-4 py-3 text-xs leading-5 text-slate-400">
              {isRuntimeMismatch
                ? 'Похоже, браузер сохранил устаревшие файлы. Можно безопасно обновить приложение.'
                : 'Если ошибка повторится после обновления, свяжитесь с администратором.'}
            </div>

            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 text-sm font-semibold text-white transition hover:brightness-110"
              >
                <RotateCcw className="h-4 w-4" />
                Попробовать снова
              </button>
              <button
                type="button"
                onClick={() => void handleRecovery()}
                disabled={recovering}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-900/70 px-4 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${recovering ? 'animate-spin' : ''}`} />
                {recovering ? 'Перезагружаем…' : 'Обновить приложение'}
              </button>
              <a
                href="/login"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-700/70 px-4 text-sm font-semibold text-slate-300 transition hover:bg-slate-900/70 hover:text-white"
              >
                Открыть страницу входа
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
